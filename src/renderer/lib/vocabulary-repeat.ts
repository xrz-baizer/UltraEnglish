export const MIN_WORD_REPEAT = 1
export const MAX_WORD_REPEAT = 5

export function normalizeWordRepeat(value: unknown, fallback = 3): number {
  const parsed = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
  return Number.isFinite(parsed)
    ? Math.max(MIN_WORD_REPEAT, Math.min(MAX_WORD_REPEAT, Math.round(parsed)))
    : fallback
}
