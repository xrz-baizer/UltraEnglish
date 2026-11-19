import type { TranscriptionSegment } from './audio-transcription'

/** LRC timestamps are sentence starts; the next timestamp closes each cue. */
export function parseLrc(
  content: string,
  duration?: number
): TranscriptionSegment[] {
  const offset =
    Number(content.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  const cues = new Map<number, string[]>()
  for (const line of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const tags = Array.from(
      line.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)
    )
    if (!tags.length) continue
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    for (const tag of tags) {
      const time = Math.max(
        0,
        Number(tag[1]) * 60 +
          Number(tag[2]) +
          Number(`0.${tag[3] || 0}`) +
          offset
      )
      if (duration && time >= duration) continue
      const entries = cues.get(time) || []
      if (text && !entries.includes(text)) entries.push(text)
      cues.set(time, entries)
    }
  }
  const times = Array.from(cues.keys()).sort((a, b) => a - b)
  return times.flatMap((startTime, index) => {
    const text = cues.get(startTime)!.join('\n')
    const endTime =
      times[index + 1] ??
      (duration && duration > startTime ? duration : startTime + 3)
    return text && endTime > startTime
      ? [{ id: `lrc-${index}`, startTime, endTime, text }]
      : []
  })
}
