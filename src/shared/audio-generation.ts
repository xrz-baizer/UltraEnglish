export const MAX_GENERATION_TEXT_LENGTH = 10_000
export const GENERATION_SAMPLE_RATE = 24_000
export const MAX_GENERATION_SAMPLES = 15 * 60 * GENERATION_SAMPLE_RATE
export const MIN_GENERATION_SPEED = 0.8
export const MAX_GENERATION_SPEED = 2
export const GENERATION_HISTORY_LIMIT = 10
export const GENERATION_QUALITIES = ['q8', 'fp32'] as const
export const GENERATION_VOICES = {
  af_heart: { name: 'Heart', locale: 'en-US' },
  am_adam: { name: 'Adam', locale: 'en-US' },
  bf_emma: { name: 'Emma', locale: 'en-GB' }
} as const
export const GENERATION_FORMATS = ['wav', 'mp3'] as const

export type GenerationQuality = (typeof GENERATION_QUALITIES)[number]
export type GenerationVoice = keyof typeof GENERATION_VOICES
export type GenerationResourceId = GenerationQuality | GenerationVoice

export interface GenerationResource {
  id: GenerationResourceId
  bytes: number
  ready: boolean
}

export interface GenerationDownload {
  ids: GenerationResourceId[]
  bytes: number
  received: number
}

export interface GenerationResourceSnapshot {
  resources: GenerationResource[]
  download: GenerationDownload | null
}

export function isGenerationQuality(value: unknown): value is GenerationQuality {
  return GENERATION_QUALITIES.some((quality) => quality === value)
}

export function isGenerationVoice(value: unknown): value is GenerationVoice {
  return typeof value === 'string' && Object.hasOwn(GENERATION_VOICES, value)
}

export function isGenerationResourceId(value: unknown): value is GenerationResourceId {
  return isGenerationQuality(value) || isGenerationVoice(value)
}

export type GenerationFormat = (typeof GENERATION_FORMATS)[number]
export interface GenerationOptions {
  speed: number
  quality: GenerationQuality
  voice: GenerationVoice
  format: GenerationFormat
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  speed: 1,
  quality: 'fp32',
  voice: 'af_heart',
  format: 'mp3'
}

export function defaultGenerationName() {
  const now = new Date()
  const timestamp = [
    now.getFullYear(), now.getMonth() + 1, now.getDate(),
    now.getHours(), now.getMinutes(), now.getSeconds()
  ].map((value) => String(value).padStart(2, '0')).join('')
  return `生成音频-${timestamp}`
}

export function normalizeGenerationName(value: string) {
  return value.trim().replace(/\.(mp3|wav)$/i, '').trim()
}

export function isValidGenerationName(name: string) {
  return new TextEncoder().encode(name).length <= 180 &&
    !/[<>:"/\\|?*\u0000-\u001f]/u.test(name) &&
    !name.endsWith('.') &&
    !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)
}

export function validateGenerationText(text: string) {
  if (text.length > MAX_GENERATION_TEXT_LENGTH) return 'tooLong'
  // Allow common typographic punctuation from copied English text.
  if (/[^\x20-\x7E\r\n\t\u00A0\u202F‘’“”–—…£€°]/u.test(text)) return 'unsupportedText'
  if (!text.trim()) return 'empty'
  if (!/[a-z]/i.test(text)) return 'englishRequired'
  return null
}

export function isGenerationFormat(value: unknown): value is GenerationFormat {
  return GENERATION_FORMATS.some((format) => format === value)
}

export function isGenerationOptions(value: unknown): value is GenerationOptions {
  if (!value || typeof value !== 'object') return false
  const options = value as Partial<Record<keyof GenerationOptions, unknown>>
  return typeof options.speed === 'number' && options.speed >= MIN_GENERATION_SPEED &&
    options.speed <= MAX_GENERATION_SPEED && Math.round(options.speed * 10) / 10 === options.speed &&
    isGenerationQuality(options.quality) &&
    isGenerationVoice(options.voice) &&
    isGenerationFormat(options.format)
}

export const AUDIO_GENERATION_PROGRESS = 'audio-generation-progress'
export const GENERATION_RESOURCES_CHANGED = 'audio-generation-resources-changed'

export type GenerationDirectory = 'model' | 'output'
export type GenerationPaths = Record<GenerationDirectory, string>

export interface GenerationSaveLocation {
  path: string
  token: string
}


export interface GeneratedAudio {
  id: string
  name: string
  duration: number
  options: GenerationOptions
  createdAt: string
  importedId?: string
}

export type GenerationState =
  | { stage: 'idle' | 'checking' | 'encoding' | 'saving' }
  | { stage: 'needs-resources'; ids: GenerationResourceId[] }
  | { stage: 'generating'; completed: number; total: number }
  | { stage: 'failed'; reason: 'model-directory' | 'synthesis'; detail?: string }
  | { stage: 'encode-failed'; reason: 'no-ffmpeg' | 'encode' }
  | { stage: 'save-failed'; detail: string }
  | { stage: 'ready'; result: GeneratedAudio }
