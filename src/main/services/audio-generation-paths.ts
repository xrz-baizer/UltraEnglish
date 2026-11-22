import { app, BrowserWindow, dialog } from 'electron'
import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, rmdir, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { models } from '../db'
import type { GenerationDirectory, GenerationPaths, GenerationSaveLocation } from '../../shared/audio-generation'

const DIRECTORY_KEYS = {
  model: 'audioGenerationModelDirectory',
  output: 'audioGenerationOutputDirectory'
} as const

function defaultDirectory(kind: GenerationDirectory) {
  return kind === 'model'
    ? join(app.getPath('userData'), 'models', 'speech-synthesis')
    : app.getPath('downloads')
}

async function readDirectory(kind: GenerationDirectory) {
  const setting = await models.UserSetting.findOne({ where: { key: DIRECTORY_KEYS[kind] } })
  const custom: unknown = setting ? JSON.parse(setting.value) : null
  if (typeof custom === 'string' && isAbsolute(custom)) return { directory: custom, custom: true }
  return { directory: defaultDirectory(kind), custom: false }
}

async function validateDirectory(directory: string, create = false) {
  if (create) await mkdir(directory, { recursive: true })
  if (!(await stat(directory)).isDirectory()) throw new Error('Expected a folder')
  await access(directory, constants.R_OK | constants.W_OK)
}

export async function writableGenerationDirectory(kind: GenerationDirectory) {
  const { directory, custom } = await readDirectory(kind)
  return writableDirectory(directory, !custom)
}

export async function writableDirectory(directory: string, create = false) {
  try {
    await validateDirectory(directory, create)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    throw new Error(code ? `${directory} (${code})` : directory, { cause: error })
  }
  return directory
}

export async function getGenerationPaths(): Promise<GenerationPaths> {
  const [model, output] = await Promise.all([readDirectory('model'), readDirectory('output')])
  return { model: model.directory, output: output.directory }
}

async function chooseDirectory(sender: WebContents, defaultPath: string): Promise<string | null> {
  const parent = BrowserWindow.fromWebContents(sender)
  const options = {
    defaultPath,
    properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
  }
  const selection = await (parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options))
  if (selection.canceled || !selection.filePaths[0] || sender.isDestroyed()) return null
  return selection.filePaths[0]
}

async function testDirectoryWritable(directory: string, create = false) {
  try {
    await validateDirectory(directory, create)
    const probe = await mkdtemp(join(directory, '.ultraenglish-write-'))
    await rmdir(probe)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    throw new Error(code ? `${directory} (${code})` : directory, { cause: error })
  }
}

type ApprovedSaveLocation = GenerationSaveLocation & { create: boolean }
const saveLocations = new WeakMap<WebContents, ApprovedSaveLocation>()

function approveSaveLocation(sender: WebContents, path: string, create = false): GenerationSaveLocation {
  const token = randomUUID()
  saveLocations.set(sender, { path, token, create })
  return { path, token }
}

export async function getGenerationSaveLocation(sender: WebContents): Promise<GenerationSaveLocation> {
  const { directory, custom } = await readDirectory('output')
  return approveSaveLocation(sender, directory, !custom)
}

export async function chooseGenerationSaveLocation(
  sender: WebContents,
  token: unknown
): Promise<GenerationSaveLocation | null> {
  const current = saveLocations.get(sender)
  const startingDirectory = current && current.token === token ? current.path : (await readDirectory('output')).directory
  const selected = await chooseDirectory(sender, startingDirectory)
  if (!selected) return null
  await testDirectoryWritable(selected)
  return approveSaveLocation(sender, selected)
}

export function consumeGenerationSaveLocation(sender: WebContents, token: unknown): ApprovedSaveLocation | undefined {
  if (token === undefined) return undefined
  const location = saveLocations.get(sender)
  if (!location || token !== location.token) throw new Error('Invalid save location')
  saveLocations.delete(sender)
  return location
}

export async function updateGenerationPath(
  sender: WebContents,
  kind: unknown,
  reset: boolean
): Promise<GenerationPaths | null> {
  if (kind !== 'model' && kind !== 'output') throw new Error('Invalid directory type')
  let directory = defaultDirectory(kind)
  if (!reset) {
    const selected = await chooseDirectory(sender, (await readDirectory(kind)).directory)
    if (!selected) return null
    directory = selected
  }

  await testDirectoryWritable(directory, reset)
  const key = DIRECTORY_KEYS[kind]
  const existing = await models.UserSetting.findOne({ where: { key } })
  const value = JSON.stringify(reset ? null : directory)
  if (existing) await existing.update({ value })
  else await models.UserSetting.create({ id: randomUUID(), key, value })
  return getGenerationPaths()
}
