export const DEFAULT_VOCABULARY_CATEGORIES = ['雅思', '四级', '其他']

/** Every category surface follows the same saved order, including numeric names. */
export function getVocabularyCategories(
  customCategories: readonly string[],
  categoryOrder: readonly string[] = [],
  bookCategories: readonly string[] = []
): string[] {
  const known = new Set([...DEFAULT_VOCABULARY_CATEGORIES, ...customCategories, ...bookCategories])
  return Array.from(new Set([...categoryOrder.filter(category => known.has(category)), ...known]))
}
