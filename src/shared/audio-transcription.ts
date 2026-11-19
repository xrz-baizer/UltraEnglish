export interface TimedWord {
  text: string
  startTime: number
  endTime: number
}
export interface TranscriptionSegment {
  id: string
  startTime: number
  endTime: number
  text: string
  words?: TimedWord[]
  ipa?: string
}
export interface WhisperToken {
  text: string
  id?: number
  offsets?: { from: number; to: number }
}

/** Merge subword tokens and punctuation without inventing word-level timestamps. */
export function wordsFromTokens(tokens: WhisperToken[], start: number, end: number): TimedWord[] {
  const words: TimedWord[] = []
  for (const token of tokens) {
    if ((token.id !== undefined && token.id >= 50257) || /^\[_.*_\]$/.test(token.text)) continue
    const text = token.text.trim()
    if (!text) continue
    const previous = words.at(-1)
    const from = Math.max(start, Number(token.offsets?.from) / 1000)
    const to = Math.min(end, Number(token.offsets?.to) / 1000)
    const punctuation = /^[\p{P}\p{S}]+$/u.test(text)
    if (previous && (punctuation || !/^\s/.test(token.text))) {
      previous.text += text
      if (!punctuation && Number.isFinite(to)) previous.endTime = Math.max(previous.endTime, to)
    } else if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
      words.push({ text, startTime: from, endTime: to })
    }
  }
  return words
}

/** Legacy SRT/VTT only contains sentence times. Mark proportional fallback as estimated in UI. */
export function getSegmentWords(segment: TranscriptionSegment): {
  words: TimedWord[]
  estimated: boolean
} {
  const texts = segment.text.trim().split(/\s+/).filter(Boolean)
  // Edited or older transcripts can retain tokens for different text. The
  // sentence is authoritative; never display those stale tokens on the left.
  if (segment.words?.length && segment.words.map(word => word.text).join(' ') === texts.join(' ')) {
    return { words: segment.words, estimated: false }
  }
  const total = texts.reduce((sum, text) => sum + text.length, 0)
  let cursor = segment.startTime
  return {
    estimated: true,
    words: texts.map((text) => {
      const startTime = cursor
      cursor += ((segment.endTime - segment.startTime) * text.length) / Math.max(1, total)
      return { text, startTime, endTime: cursor }
    })
  }
}
