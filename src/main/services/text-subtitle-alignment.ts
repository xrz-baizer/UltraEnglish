import { findExecutable } from './whisper'
import type { TranscriptionSegment } from '../../shared/audio-transcription'

/** Align supplied English text locally, then group real word times by sentence. */
export async function alignTextSubtitles(
  file: string,
  content: string
): Promise<TranscriptionSegment[]> {
  const text = content
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text.length > 200000) throw new Error('Invalid transcript')
  const ffmpeg = findExecutable('ffmpeg')
  if (!ffmpeg) throw new Error('no_ffmpeg')
  const engine = await import('echogarden')
  engine.setGlobalOption('ffmpegPath', ffmpeg)
  const result = await engine.align(file, text, {
    engine: 'dtw',
    language: 'en',
    crop: false
  })
  const sentences = Array.from(
    new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)
  )
  const segments = sentences.flatMap((sentence, index) => {
    const words = result.wordTimeline.filter(
      (word) =>
        word.startOffsetUtf16 !== undefined &&
        word.startOffsetUtf16 >= sentence.index &&
        word.startOffsetUtf16 < sentence.index + sentence.segment.length &&
        Number.isFinite(word.startTime) &&
        word.endTime > word.startTime
    )
    if (!words.length) return []
    return [
      {
        id: `txt-${index}`,
        text: sentence.segment.trim(),
        startTime: words[0].startTime,
        endTime: words[words.length - 1].endTime,
        words: words.map((word, wordIndex) => ({
          text: text.slice(word.startOffsetUtf16!, words[wordIndex+1]?.startOffsetUtf16 ?? sentence.index+sentence.segment.length).trim(),
          startTime: word.startTime,
          endTime: word.endTime
        }))
      }
    ]
  })
  if (
    !segments.length ||
    segments.length !==
      sentences.filter((sentence) => sentence.segment.trim()).length
  )
    throw new Error('Text alignment failed')
  return segments
}
