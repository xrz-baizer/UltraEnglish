export type Theme = 'light' | 'dark' | 'system'

export function normalizeTheme(value: unknown, fallback: Theme = 'system'): Theme {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return value === 'eye-protection' ? 'light' : fallback
}
