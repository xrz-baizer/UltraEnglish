export interface VocabularyBook {
  id: string
  name: string
  description: string | null
  category: string | null
  wordCount: number
  isBuiltIn: boolean
}
