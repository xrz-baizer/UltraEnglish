export type AppCommand = 'home' | 'vocabulary' | 'audios' | 'settings'

export interface WindowAppearance {
  platform: string
  reducedTransparency: boolean
  highContrast: boolean
}

export interface LearningOverview {
  booksCount: number
  audiosCount: number
  practicedWords: number
  featuredBook: { id: string; name: string; wordCount: number } | null
  recentPractices: Array<{
    id: string
    bookId: string
    bookName: string
    chapter: number
    totalWords: number
    createdAt: string
  }>
}
