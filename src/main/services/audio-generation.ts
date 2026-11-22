import { BrowserWindow, ipcMain, utilityProcess } from 'electron'
import type { WebContents } from 'electron'
import log from 'electron-log'
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, link, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { registerAudioGenerationHistoryHandlers, recordAudioGeneration } from './audio-generation-history'
import {
  chooseGenerationSaveLocation, consumeGenerationSaveLocation, getGenerationPaths, getGenerationSaveLocation,
  updateGenerationPath, writableDirectory, writableGenerationDirectory
} from './audio-generation-paths'
import { downloadKokoroFiles, getKokoroResources, kokoroAssets, kokoroFile, missingKokoroFiles } from './kokoro-model'
import type { SynthesisInput, SynthesisMessage, SynthesizedAudio } from './audio-generation-worker'
import { encodeGeneratedMp3 } from './audio-generation-encoding'
import {
  AUDIO_GENERATION_PROGRESS, DEFAULT_GENERATION_OPTIONS, GENERATION_RESOURCES_CHANGED,
  defaultGenerationName, isGenerationOptions, isGenerationResourceId, isValidGenerationName,
  normalizeGenerationName, validateGenerationText
} from '../../shared/audio-generation'
import type { GenerationDownload, GenerationFormat, GenerationOptions, GenerationResourceSnapshot, GenerationState } from '../../shared/audio-generation'

interface GenerationTask {
  id: string
  owner: WebContents
  text: string
  name: string
  options: GenerationOptions
  controller: AbortController
  state: GenerationState
  destination?: ReturnType<typeof consumeGenerationSaveLocation>
  pending?: SynthesizedAudio
  mp3?: Uint8Array
}

const tasks = new WeakMap<WebContents, GenerationTask>()
const trackedOwners = new WeakSet<WebContents>()

function update(task: GenerationTask, state: GenerationState) {
  task.state = state
  if (!task.owner.isDestroyed()) task.owner.send(AUDIO_GENERATION_PROGRESS, state)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function runSynthesis(task: GenerationTask, assets: Pick<SynthesisInput, 'modelDirectory' | 'voiceDirectory'>): Promise<SynthesizedAudio> {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(join(__dirname, 'audio-generation-worker.js'), [], {
      serviceName: 'UltraEnglish Audio Generation',
      stdio: 'pipe'
    })
    child.stdout?.resume()
    child.stderr?.on('data', (data: Buffer) => log.debug(data.toString().trim()))
    const signal = task.controller.signal
    const cancel = () => child.kill()
    signal.addEventListener('abort', cancel, { once: true })
    child.once('exit', (code) => {
      signal.removeEventListener('abort', cancel)
      reject(new Error(`Synthesis process exited (${code})`))
    })
    child.on('message', (message: SynthesisMessage) => {
      if (message.type === 'progress') {
        update(task, { stage: 'generating', completed: message.completed, total: message.total })
      } else {
        if (message.type === 'result') resolve(message.result)
        else reject(new Error(message.error))
        child.kill()
      }
    })
    const input: SynthesisInput = {
      text: task.text,
      modelDirectory: assets.modelDirectory,
      voiceDirectory: assets.voiceDirectory,
      voice: task.options.voice,
      speed: task.options.speed
    }
    child.postMessage(input)
    if (signal.aborted) cancel()
  })
}

async function saveGeneratedAudio(directory: string, name: string, bytes: Uint8Array, format: GenerationFormat): Promise<string> {
  const temporary = join(directory, `.ultraenglish-${randomUUID()}.part`)
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    for (let index = 0; ; index++) {
      const target = join(directory, `${name}${index ? `-${index}` : ''}.${format}`)
      try {
        try {
          await link(temporary, target)
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          if (code !== 'ENOTSUP' && code !== 'EPERM' && code !== 'EXDEV' && code !== 'ENOSYS') throw error
          // Some removable drives cannot create hard links.
          await copyFile(temporary, target, constants.COPYFILE_EXCL)
        }
        return target
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
  } finally {
    await rm(temporary, { force: true }).catch((error: unknown) =>
      log.warn('Could not clean up temporary audio file', error)
    )
  }
}

async function saveTask(task: GenerationTask) {
  const pending = task.pending
  if (!pending) return
  const { format } = task.options
  let bytes = pending.wav
  if (format === 'mp3') {
    update(task, { stage: 'encoding' })
    try {
      task.mp3 ??= await encodeGeneratedMp3(pending.wav, task.controller.signal)
      bytes = task.mp3
    } catch (error) {
      if (task.controller.signal.aborted) return
      log.warn('Could not encode generated MP3', error)
      update(task, { stage: 'encode-failed', reason: describe(error) === 'no-ffmpeg' ? 'no-ffmpeg' : 'encode' })
      return
    }
  }
  update(task, { stage: 'saving' })
  let directory: string | undefined
  let newFile: string | undefined
  try {
    directory = task.destination
      ? await writableDirectory(task.destination.path, task.destination.create)
      : await writableGenerationDirectory('output')
    task.controller.signal.throwIfAborted()
    newFile = await saveGeneratedAudio(directory, task.name, bytes, format)
    const result = await recordAudioGeneration({
      id: task.id,
      filePath: newFile,
      size: bytes.byteLength,
      options: task.options,
      duration: pending.duration,
      content: task.text,
      segments: JSON.stringify(pending.segments),
      createdAt: new Date()
    })
    newFile = undefined
    task.pending = undefined
    task.mp3 = undefined
    update(task, { stage: 'ready', result })
  } catch (error) {
    if (newFile) {
      await rm(newFile, { force: true }).catch((cleanupError: unknown) =>
        log.warn('Could not clean up an unrecorded audio file', cleanupError)
      )
    }
    const code = (error as NodeJS.ErrnoException).code
    const detail = directory && code ? `${directory} (${code})` : describe(error)
    update(task, { stage: 'save-failed', detail })
  }
}

async function prepareTask(task: GenerationTask) {
  update(task, { stage: 'checking' })
  const signal = task.controller.signal
  let reason: Extract<GenerationState, { stage: 'failed' }>['reason'] = 'model-directory'
  try {
    const root = await writableGenerationDirectory('model')
    const assets = kokoroAssets(root, task.options)
    const missing = await missingKokoroFiles(assets.files)
    signal.throwIfAborted()
    if (missing.length) {
      update(task, { stage: 'needs-resources', ids: missing.map((file) => file.id) })
      return
    }
    reason = 'synthesis'
    update(task, { stage: 'generating', completed: 0, total: 0 })
    task.pending = await runSynthesis(task, assets)
    signal.throwIfAborted()
    await saveTask(task)
  } catch (error) {
    if (signal.aborted) {
      update(task, { stage: 'idle' })
      return
    }
    log.error('Audio generation failed', reason, error)
    update(task, { stage: 'failed', reason, detail: describe(error) })
  }
}

function startTask(owner: WebContents, text: unknown, options: unknown, name: unknown, locationToken: unknown): void {
  if (typeof text !== 'string' || validateGenerationText(text)) throw new Error('Invalid English text')
  if (!isGenerationOptions(options)) throw new Error('Invalid audio generation options')
  if (name !== undefined && (typeof name !== 'string' || name.length > 180 ||
    !isValidGenerationName(normalizeGenerationName(name)))) throw new Error('Invalid audio filename')
  const current = tasks.get(owner)
  if (current && !['idle', 'needs-resources', 'failed', 'save-failed', 'encode-failed', 'ready'].includes(current.state.stage)) {
    return
  }
  if (!trackedOwners.has(owner)) {
    trackedOwners.add(owner)
    owner.once('destroyed', () => {
      tasks.get(owner)?.controller.abort()
      tasks.delete(owner)
    })
  }
  const task: GenerationTask = {
    id: randomUUID(),
    owner,
    text,
    name: (typeof name === 'string' && normalizeGenerationName(name)) || defaultGenerationName(),
    options: { ...options },
    destination: consumeGenerationSaveLocation(owner, locationToken),
    controller: new AbortController(),
    state: { stage: 'idle' }
  }
  tasks.set(owner, task)
  void prepareTask(task)
}

let activeDownload: { controller: AbortController; progress: GenerationDownload } | undefined

function broadcastGenerationResources() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(GENERATION_RESOURCES_CHANGED, activeDownload?.progress ?? null)
    }
  }
}

async function downloadGenerationResources(ids: unknown) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 5 || !ids.every(isGenerationResourceId)) {
    throw new Error('Invalid speech synthesis resources')
  }
  if (activeDownload) throw new Error('A speech synthesis download is already active')

  const controller = new AbortController()
  const request = [...new Set(ids)]
  const job = { controller, progress: { ids: request, bytes: 0, received: 0 } }
  activeDownload = job
  broadcastGenerationResources()
  try {
    const root = await writableGenerationDirectory('model')
    const missing = await missingKokoroFiles(request.map((id) => kokoroFile(root, id)))
    controller.signal.throwIfAborted()
    job.progress.bytes = missing.reduce((total, file) => total + file.bytes, 0)
    if (missing.length) {
      broadcastGenerationResources()
      await downloadKokoroFiles(missing, controller.signal, (received) => {
        job.progress.received = received
        broadcastGenerationResources()
      })
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error
  } finally {
    activeDownload = undefined
    broadcastGenerationResources()
  }
}

async function updateGenerationDirectory(sender: WebContents, kind: unknown, reset: boolean) {
  const paths = await updateGenerationPath(sender, kind, reset)
  if (paths && kind === 'model') broadcastGenerationResources()
  return paths
}

async function getGenerationResourceSnapshot(): Promise<GenerationResourceSnapshot> {
  const { model } = await getGenerationPaths()
  return { resources: await getKokoroResources(model), download: activeDownload?.progress ?? null }
}

export function registerAudioGenerationHandlers(): void {
  ipcMain.handle('audio-generation-paths', getGenerationPaths)
  ipcMain.handle('audio-generation-choose-path', ({ sender }, kind: unknown) =>
    updateGenerationDirectory(sender, kind, false)
  )
  ipcMain.handle('audio-generation-reset-path', ({ sender }, kind: unknown) =>
    updateGenerationDirectory(sender, kind, true)
  )
  ipcMain.handle('audio-generation-state', ({ sender }) => {
    const task = tasks.get(sender)
    return {
      state: task?.state ?? { stage: 'idle' },
      text: task?.text ?? '',
      options: task?.options ?? DEFAULT_GENERATION_OPTIONS
    }
  })
  ipcMain.handle('audio-generation-save-location', ({ sender }) => getGenerationSaveLocation(sender))
  ipcMain.handle('audio-generation-select-save-location', ({ sender }, token: unknown) =>
    chooseGenerationSaveLocation(sender, token)
  )
  ipcMain.handle('audio-generation-start', ({ sender }, text: unknown, options: unknown, name: unknown, locationToken: unknown) =>
    startTask(sender, text, options, name, locationToken)
  )
  ipcMain.handle('audio-generation-resources', getGenerationResourceSnapshot)
  ipcMain.handle('audio-generation-download', (_, ids: unknown) => downloadGenerationResources(ids))
  ipcMain.handle('audio-generation-cancel-download', () => activeDownload?.controller.abort())
  ipcMain.handle('audio-generation-retry-save', ({ sender }, fallback: unknown, locationToken: unknown) => {
    const task = tasks.get(sender)
    if (!task || (task.state.stage !== 'save-failed' && task.state.stage !== 'encode-failed')) return
    if (fallback !== undefined && fallback !== 'wav') throw new Error('Invalid rescue format')
    if (locationToken !== undefined) task.destination = consumeGenerationSaveLocation(sender, locationToken)
    if (fallback === 'wav') task.options = { ...task.options, format: 'wav' }
    void saveTask(task)
  })
  registerAudioGenerationHistoryHandlers()
}
