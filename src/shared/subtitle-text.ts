/** Blank lines delimit subtitle groups. Otherwise use English sentence boundaries. */
export function groupSubtitleText(content: string) {
  const paragraphs = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n(?:[^\S\n]*\n)+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
  const text = paragraphs.join(' ')
  let offset = 0
  const groups = paragraphs.length > 1
    ? paragraphs.map((segment) => {
        const index = offset
        offset += segment.length + 1
        return { index, segment }
      })
    : Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text))
  return { text, groups }
}
