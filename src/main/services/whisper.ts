import { wordsFromTokens } from '../../shared/audio-transcription'
import type { WhisperToken, TranscriptionSegment } from '../../shared/audio-transcription'
/**
 * Whisper Speech-to-Text Service
 * Manages Whisper model downloads and audio transcription
 */

import { app } from 'electron'
import { join, delimiter, isAbsolute } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, createWriteStream, unlinkSync, statSync } from 'fs'
import { get } from 'https'
import log from 'electron-log'

// Model definitions with Hugging Face URLs
export interface WhisperModel {
  id: string
  name: string
  size: string // Human readable size
  sizeBytes: number // Size in bytes for download progress
  description: string
  url: string
  filename: string
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    size: '75 MB',
    sizeBytes: 75 * 1024 * 1024,
    description: 'Fast, lower accuracy',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    filename: 'ggml-tiny.bin'
  },
  {
    id: 'base',
    name: 'Base',
    size: '142 MB',
    sizeBytes: 142 * 1024 * 1024,
    description: 'Balanced speed and accuracy',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    filename: 'ggml-base.bin'
  },
  {
    id: 'small',
    name: 'Small',
    size: '466 MB',
    sizeBytes: 466 * 1024 * 1024,
    description: 'Good accuracy, moderate speed',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    filename: 'ggml-small.bin'
  },
  {
    id: 'medium',
    name: 'Medium',
    size: '1.5 GB',
    sizeBytes: 1500 * 1024 * 1024,
    description: 'High accuracy, slower',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    filename: 'ggml-medium.bin'
  }
]

/**
 * Get the directory where bundled Whisper models are stored (read-only)
 */
export function getBundledModelsDir(): string {
  if (app.isPackaged) {
    // Production: models are in the app's resources directory
    return join(process.resourcesPath, 'models', 'whisper')
  } else {
    // Development: models are in assets/models/whisper relative to project root
    // __dirname is out/main when compiled
    return join(__dirname, '../../assets/models/whisper')
  }
}

/**
 * Get the directory where user-downloaded Whisper models are stored
 */
let modelDirectory = ''
export function configureModelDirectory(directory: string): void {
  modelDirectory = isAbsolute(directory) ? directory : ''
}
export function getUserModelsDir(): string {
  const dir = modelDirectory || join(app.getPath('userData'), 'models', 'whisper')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Get the directory where Whisper models are stored (for downloads)
 * @deprecated Use getUserModelsDir() for downloads, getBundledModelsDir() for bundled
 */
export function getModelsDir(): string {
  return getUserModelsDir()
}

/**
 * Check if a model file exists and is valid (at least 50% of expected size)
 */
function isModelValid(modelPath: string, expectedSize: number): boolean {
  if (!existsSync(modelPath) || !statSync(modelPath).isFile()) return false
  const stats = statSync(modelPath)
  return stats.size > expectedSize * 0.5
}

/**
 * Get list of available model IDs (both bundled and user-downloaded)
 */
export function getDownloadedModels(): string[] {
  const bundledDir = getBundledModelsDir()
  const userDir = getUserModelsDir()
  const available: string[] = []

  for (const model of WHISPER_MODELS) {
    // Check bundled models first
    const bundledPath = join(bundledDir, model.filename)
    if (isModelValid(bundledPath, model.sizeBytes)) {
      available.push(model.id)
      continue
    }

    // Check user-downloaded models
    const userPath = join(userDir, model.filename)
    if (isModelValid(userPath, model.sizeBytes)) {
      available.push(model.id)
    }
  }

  return available
}

/**
 * Get the path to a model (checks bundled first, then user-downloaded)
 */
export function getModelPath(modelId: string): string | null {
  const model = WHISPER_MODELS.find((m) => m.id === modelId)
  if (!model) return null

  // Check bundled models first
  const bundledPath = join(getBundledModelsDir(), model.filename)
  if (isModelValid(bundledPath, model.sizeBytes)) {
    return bundledPath
  }

  // Check user-downloaded models
  const userPath = join(getUserModelsDir(), model.filename)
  if (isModelValid(userPath, model.sizeBytes)) {
    return userPath
  }

  return null
}

/**
 * Check if a model is bundled with the app (not user-downloaded)
 */
export function isModelBundled(modelId: string): boolean {
  const model = WHISPER_MODELS.find((m) => m.id === modelId)
  if (!model) return false

  const bundledPath = join(getBundledModelsDir(), model.filename)
  return isModelValid(bundledPath, model.sizeBytes)
}

/**
 * Download progress callback type
 */
export type DownloadProgressCallback = (progress: {
  modelId: string
  downloaded: number
  total: number
  percent: number
}) => void

/**
 * Download a Whisper model
 */
export async function downloadModel(
  modelId: string,
  onProgress?: DownloadProgressCallback
): Promise<boolean> {
  const model = WHISPER_MODELS.find((m) => m.id === modelId)
  if (!model) {
    log.error(`Model not found: ${modelId}`)
    return false
  }

  const modelsDir = getModelsDir()
  const destPath = join(modelsDir, model.filename)
  const tempPath = `${destPath}.tmp`

  // Check if already downloaded
  if (existsSync(destPath)) {
    const stats = statSync(destPath)
    if (stats.size > model.sizeBytes * 0.5) {
      log.info(`Model ${modelId} already downloaded`)
      return true
    }
  }

  log.info(`Downloading model ${modelId} from ${model.url}`)

  return new Promise((resolve) => {
    const downloadWithRedirect = (url: string) => {
      get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            log.info(`Redirecting to ${redirectUrl}`)
            downloadWithRedirect(redirectUrl)
            return
          }
        }

        if (response.statusCode !== 200) {
          log.error(`Failed to download model: HTTP ${response.statusCode}`)
          resolve(false)
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10) || model.sizeBytes
        let downloadedSize = 0

        const file = createWriteStream(tempPath)

        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length
          if (onProgress) {
            onProgress({
              modelId,
              downloaded: downloadedSize,
              total: totalSize,
              percent: Math.round((downloadedSize / totalSize) * 100)
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          // Rename temp file to final name
          try {
            if (existsSync(destPath)) {
              unlinkSync(destPath)
            }
            const { renameSync } = require('fs')
            renameSync(tempPath, destPath)
            log.info(`Model ${modelId} downloaded successfully`)
            resolve(true)
          } catch (err) {
            log.error(`Failed to rename model file: ${err}`)
            resolve(false)
          }
        })

        file.on('error', (err) => {
          log.error(`Error writing model file: ${err}`)
          file.close()
          if (existsSync(tempPath)) {
            unlinkSync(tempPath)
          }
          resolve(false)
        })
      }).on('error', (err) => {
        log.error(`Error downloading model: ${err}`)
        resolve(false)
      })
    }

    downloadWithRedirect(model.url)
  })
}

/**
 * Delete a downloaded model
 */
export function deleteModel(modelId: string): boolean {
  const model = WHISPER_MODELS.find((m) => m.id === modelId)
  if (!model) return false

  const modelPath = join(getModelsDir(), model.filename)
  if (existsSync(modelPath)) {
    try {
      unlinkSync(modelPath)
      log.info(`Model ${modelId} deleted`)
      return true
    } catch (err) {
      log.error(`Failed to delete model: ${err}`)
      return false
    }
  }
  return false
}

/**
 * Transcription segment type
 */

/**
 * Transcription result type
 */
export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  language: string
  duration: number
}

const runFile = promisify(execFile)

export function findExecutable(name: string): string | null {
  const filename = process.platform === 'win32' ? `${name}.exe` : name
  const bundled = app.isPackaged
    ? join(process.resourcesPath, 'bin')
    : join(__dirname, '../../assets/bin')
  const candidates = [
    join(bundled, filename),
    ...(name === 'whisper-cli'
      ? [join(bundled, 'whisper', process.arch, process.platform, 'main')]
      : []),
    ...[
      ...(process.env.PATH || '').split(delimiter),
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin'
    ].map((dir) => join(dir, filename))
  ]
  return candidates.find((path) => existsSync(path)) || null
}

/** Local inference. No audio is uploaded; temporary PCM and JSON are removed after each job. */
export async function transcribeAudio(
  audioPath: string,
  modelId = 'tiny',
  customModelPath?: string
): Promise<TranscriptionResult> {
  const modelPath = customModelPath?.trim() || getModelPath(modelId)
  if (!modelPath || !existsSync(modelPath) || !statSync(modelPath).isFile())
    throw new Error('no_model')
  const executable = findExecutable('whisper-cli')
  if (!executable) throw new Error('no_engine')
  const ffmpeg = findExecutable('ffmpeg')
  if (!ffmpeg) throw new Error('no_ffmpeg')
  const directory = await mkdtemp(join(tmpdir(), 'ultra-transcription-'))
  try {
    const wav = join(directory, 'audio.wav')
    const output = join(directory, 'transcript')
    await runFile(
      ffmpeg,
      [
        '-nostdin',
        '-y',
        '-i',
        audioPath,
        '-vn',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        wav
      ],
      { timeout: 300000, maxBuffer: 4 * 1024 * 1024 }
    )
    await runFile(
      executable,
      ['-m', modelPath, '-f', wav, '-l', 'en', '-ojf', '-of', output, '-ng', '-ml', '10000', '-sow'],
      { timeout: 3600000, maxBuffer: 16 * 1024 * 1024 }
    )
    const result = JSON.parse(await readFile(`${output}.json`, 'utf8')) as {
      transcription?: Array<{
        offsets?: { from: number; to: number }
        text?: string
        tokens?: WhisperToken[]
      }>
    }
    const segments = (result.transcription || []).flatMap((segment) => {
      const startTime = Number(segment.offsets?.from) / 1000
      const endTime = Number(segment.offsets?.to) / 1000
      const text = segment.text?.trim() || ''
      return Number.isFinite(startTime) && endTime > startTime && text
        ? [
            {
              id: randomUUID(),
              startTime,
              endTime,
              text,
              words: wordsFromTokens(segment.tokens || [], startTime, endTime)
            }
          ]
        : []
    })
    // Preserve model sentence boundaries; merge continuation chunks as in the reference reader.
    for (let index = 0; index < segments.length - 1;) {
      const current = segments[index]
      if (!/[.!?]["'”’)]*$/.test(current.text) || /\b(?:Mr|Mrs|Ms|Dr|Prof|St)\.$/i.test(current.text)) {
        const next = segments[index + 1]
        current.text += ' ' + next.text
        current.endTime = next.endTime
        current.words.push(...next.words)
        segments.splice(index + 1, 1)
      } else index++
    }
    if (!segments.length) throw new Error('no_speech')
    return {
      text: segments.map((segment) => segment.text).join(' '),
      segments,
      language: 'en',
      duration: segments.at(-1)!.endTime
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/**
 * Get the best available model for transcription
 */
export function getBestAvailableModel(): string | null {
  const downloaded = getDownloadedModels()
  if (downloaded.length === 0) return null

  // Prefer larger models for better accuracy
  const priority = ['medium', 'small', 'base', 'tiny']
  for (const modelId of priority) {
    if (downloaded.includes(modelId)) {
      return modelId
    }
  }
  return downloaded[0]
}
