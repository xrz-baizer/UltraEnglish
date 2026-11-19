import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compare user input with target word
 * @returns -2 if complete match, -1 if partial match, or index of first wrong char
 */
export function compareWord(word: string, input: string): number {
  const lowerWord = word.toLowerCase()
  const lowerInput = input.toLowerCase()

  if (lowerInput.length > lowerWord.length) {
    return lowerWord.length
  }

  for (let i = 0; i < lowerWord.length; i++) {
    if (typeof lowerInput[i] !== 'undefined') {
      if (lowerWord[i] !== lowerInput[i]) {
        return i // Return index of first wrong character
      }
    } else {
      return -1 // Input incomplete but correct so far
    }
  }

  return lowerInput.length === lowerWord.length ? -2 : -1
}

/**
 * Format duration in seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate chapter count based on word count and chapter length
 */
export function getChapterCount(wordCount: number, chapterLength: number): number {
  return Math.ceil(wordCount / chapterLength)
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
