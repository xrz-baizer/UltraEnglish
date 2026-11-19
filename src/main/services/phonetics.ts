import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { findExecutable } from './whisper'
import type { TranscriptionSegment } from '../../shared/audio-transcription'

type PhoneEntry = { type: string; text: string; timeline?: PhoneEntry[] }
const phones = (entry: PhoneEntry): string =>
  entry.type === 'phone'
    ? entry.text
    : (entry.timeline || []).map(phones).join('')

// Uses the reference application's sentence/audio alignment, not dictionary IPA.
export async function generateSentenceIpa(
  file: string,
  segment: TranscriptionSegment
): Promise<string> {
  if (
    !Number.isFinite(segment.startTime) ||
    !Number.isFinite(segment.endTime) ||
    segment.endTime <= segment.startTime ||
    !segment.text.trim()
  )
    throw new Error('Invalid sentence')
  const ffmpeg = findExecutable('ffmpeg')
  if (!ffmpeg) throw new Error('no_ffmpeg')
  const directory = await mkdtemp(join(tmpdir(), 'ultra-ipa-'))
  try {
    const clip = join(directory, 'sentence.wav')
    await promisify(execFile)(
      ffmpeg,
      [
        '-y',
        '-ss',
        String(Math.max(0, segment.startTime)),
        '-i',
        file,
        '-t',
        String(segment.endTime - segment.startTime),
        '-ar',
        '16000',
        '-ac',
        '1',
        clip
      ],
      { timeout: 120000 }
    )
    const engine = await import('echogarden')
    engine.setGlobalOption('ffmpegPath', ffmpeg)
    const result = await engine.align(clip, segment.text, {
      engine: 'dtw',
      language: 'en',
      crop: false
    })
    const ipa = result.wordTimeline.map(phones).filter(Boolean).join(' ')
    if (!ipa) throw new Error('No phonemes generated')
    return `/${ipa}/`
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
