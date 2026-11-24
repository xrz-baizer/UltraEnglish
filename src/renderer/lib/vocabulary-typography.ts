export const WORD_FONT_OPTIONS = [
  {
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    labelKey: 'settings.vocabulary.wordFontSystem'
  },
  { value: 'Arial, sans-serif', labelKey: 'settings.vocabulary.wordFontArial' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', labelKey: 'settings.vocabulary.wordFontHelvetica' },
  { value: 'Georgia, serif', labelKey: 'settings.vocabulary.wordFontGeorgia' },
  { value: '"Times New Roman", Times, serif', labelKey: 'settings.vocabulary.wordFontTimes' }
] as const

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}
