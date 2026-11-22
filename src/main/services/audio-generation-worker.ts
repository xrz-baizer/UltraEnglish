import { GENERATION_SAMPLE_RATE as SAMPLE_RATE, GENERATION_VOICES, MAX_GENERATION_SAMPLES } from '../../shared/audio-generation'
import type { GenerationOptions } from '../../shared/audio-generation'
import { groupSubtitleText } from '../../shared/subtitle-text'
import type { TranscriptionSegment } from '../../shared/audio-transcription'

const GAP_SAMPLES = Math.round(SAMPLE_RATE * 0.16)
const MAX_CHUNK_LENGTH = 120

export interface SynthesisInput {
  text: string
  modelDirectory: string
  voiceDirectory: string
  voice: GenerationOptions['voice']
  speed: GenerationOptions['speed']
}

export interface SynthesizedAudio {
  wav: Uint8Array
  segments: TranscriptionSegment[]
  duration: number
}

export type SynthesisMessage =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'result'; result: SynthesizedAudio }
  | { type: 'failed'; error: string }

function splitForSynthesis(text: string): string[] {
  const sentences = new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)
  const chunks: string[] = []
  for (const { segment } of sentences) {
    let rest = segment.trim()
    while (rest.length > MAX_CHUNK_LENGTH) {
      const space = rest.lastIndexOf(' ', MAX_CHUNK_LENGTH)
      let end = space > 0 ? space : MAX_CHUNK_LENGTH
      if (rest.charCodeAt(end - 1) >= 0xd800 && rest.charCodeAt(end - 1) <= 0xdbff) end--
      chunks.push(rest.slice(0, end))
      rest = rest.slice(end).trimStart()
    }
    if (rest) chunks.push(rest)
  }
  return chunks
}

async function synthesize(
  { text, modelDirectory, voiceDirectory, voice: voiceId, speed }: SynthesisInput,
  progress: (completed: number, total: number) => void
): Promise<SynthesizedAudio> {
  const { groups } = groupSubtitleText(text)
  const planned = groups.map(({ segment }) => ({
    text: segment.trim(),
    chunks: splitForSynthesis(segment).filter((chunk) => /[\p{L}\p{N}]/u.test(chunk))
  }))
  const total = planned.reduce((sum, group) => sum + Math.max(group.chunks.length, 1), 0)
  progress(0, total)

  const [{ KokoroTTS, voiceList }, { loadLexiconsForLanguage }] = await Promise.all([
    import('echogarden/dist/synthesis/KokoroTTS.js'),
    import('echogarden/dist/nlp/Lexicon.js')
  ])
  const selected = GENERATION_VOICES[voiceId]
  const voice = voiceList.find((entry) => entry.name === selected.name && entry.languages[0] === selected.locale)
  if (!voice) throw new Error('Missing English voice')
  const lexicons = await loadLexiconsForLanguage(selected.locale)
  const engine = new KokoroTTS(modelDirectory, voiceDirectory, ['cpu'])

  const parts: (Float32Array | number)[] = []
  const segments: TranscriptionSegment[] = []
  let samples = 0
  let completed = 0
  const append = (part: Float32Array | number) => {
    samples += typeof part === 'number' ? part : part.length
    if (samples > MAX_GENERATION_SAMPLES) throw new Error('Generated audio exceeds 15 minutes')
    parts.push(part)
  }
  try {
    for (const group of planned) {
      if (segments.length) append(GAP_SAMPLES)
      const startTime = samples / SAMPLE_RATE
      for (const chunk of group.chunks) {
        const { rawAudio } = await engine.synthesizeSentence(chunk, voice, speed, lexicons)
        const pcm = rawAudio.audioChannels[0]
        if (rawAudio.sampleRate !== SAMPLE_RATE || !pcm?.length) {
          throw new Error('Unexpected audio output')
        }
        append(pcm)
        progress(++completed, total)
      }
      if (!group.chunks.length) {
        append(GAP_SAMPLES)
        progress(++completed, total)
      }
      segments.push({
        id: `tts-${segments.length}`,
        text: group.text,
        startTime,
        endTime: samples / SAMPLE_RATE
      })
    }
  } finally {
    await engine.session?.release()
  }

  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(SAMPLE_RATE, 24)
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  let offset = 44
  for (const part of parts) {
    if (typeof part === 'number') {
      offset += part * 2
    } else {
      for (const sample of part) {
        const value = Math.max(-1, Math.min(1, sample))
        wav.writeInt16LE(Math.round(value * (value < 0 ? 32768 : 32767)), offset)
        offset += 2
      }
    }
  }
  return { wav, segments, duration: samples / SAMPLE_RATE }
}

process.parentPort.once('message', async ({ data }: { data: SynthesisInput }) => {
  const send = (message: SynthesisMessage) => process.parentPort.postMessage(message)
  try {
    const result = await synthesize(data, (completed, total) => send({ type: 'progress', completed, total }))
    send({ type: 'result', result })
  } catch (error) {
    send({ type: 'failed', error: error instanceof Error ? error.message : String(error) })
  }
})
