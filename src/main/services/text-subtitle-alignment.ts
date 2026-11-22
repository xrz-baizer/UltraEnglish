import { findExecutable } from './whisper'
import type { TranscriptionSegment } from '../../shared/audio-transcription'
import { groupSubtitleText } from '../../shared/subtitle-text'

/** Align supplied English text locally, keeping paragraphs together when separated by blank lines. */
export async function alignTextSubtitles(
  file: string,
  content: string
): Promise<TranscriptionSegment[]> {
  const { text, groups } = groupSubtitleText(content)
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
  const segments = groups.flatMap((group, index) => {
    const end = group.index + group.segment.length
    const words = result.wordTimeline.filter(
      (word) =>
        word.startOffsetUtf16 !== undefined &&
        word.startOffsetUtf16 >= group.index &&
        word.startOffsetUtf16 < end &&
        Number.isFinite(word.startTime) &&
        word.endTime > word.startTime
    )
    if (!words.length) return []
    return [
      {
        id: `txt-${index}`,
        text: group.segment.trim(),
        startTime: words[0].startTime,
        endTime: words[words.length - 1].endTime,
        words: words.map((word, wordIndex) => ({
          text: text.slice(word.startOffsetUtf16!, words[wordIndex + 1]?.startOffsetUtf16 ?? end).trim(),
          startTime: word.startTime,
          endTime: word.endTime
        }))
      }
    ]
  })
  if (
    !segments.length ||
    segments.length !==
      groups.filter((group) => group.segment.trim()).length
  )
    throw new Error('Text alignment failed')
  return segments
}
