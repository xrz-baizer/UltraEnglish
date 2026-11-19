import { models } from '../db'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'

export interface BackupData {
  version: number
  timestamp: number
  settings: Array<{ key: string; value: string }>
  customBooks: Array<{
    id: string
    name: string
    description: string | null
    category: string | null
    language: string
    wordCount: number
    bookType: string
    chapterLength: number
    words: Array<{
      word: string
      phonetic: string | null
      definition: string
      translation: string | null
      examples: string | null
      order: number
    }>
  }>
  progress: Array<{
    vocabularyBookId: string
    word: string
    correctCount: number
    wrongCount: number
    lastPracticed: string | null
    mastered: boolean
    familiar: boolean
  }>
}

export async function exportUserData(): Promise<BackupData> {
  log.info('Starting user data export...')

  // 1. Export Settings
  const settings = await models.UserSetting.findAll()
  
  // 2. Export Custom Books
  const customBooks = await models.VocabularyBook.findAll({
    where: { isBuiltIn: false },
    include: [{ model: models.Word, as: 'words' }]
  })

  // 3. Export Progress
  // We need to join with Word to get the word text, because wordId changes on re-seed/re-import
  const progressList = await models.WordProgress.findAll({
    include: [{ model: models.Word, required: true }] // Inner join to ensure word exists
  })

  const backup: BackupData = {
    version: 1,
    timestamp: Date.now(),
    settings: settings.map(s => ({ key: s.key, value: s.value })),
    customBooks: customBooks.map(book => ({
      id: book.id,
      name: book.name,
      description: book.description,
      category: book.category,
      language: book.language,
      wordCount: book.wordCount,
      bookType: book.bookType,
      chapterLength: book.chapterLength,
      words: (book as any).words.map((w: any) => ({
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        translation: w.translation,
        examples: w.examples,
        order: w.order
      }))
    })),
    progress: progressList.map((p: any) => ({
      vocabularyBookId: p.vocabularyBookId,
      word: p.Word.word, // Access joined Word
      correctCount: p.correctCount,
      wrongCount: p.wrongCount,
      lastPracticed: p.lastPracticed ? p.lastPracticed.toISOString() : null,
      mastered: p.mastered,
      familiar: p.familiar
    }))
  }

  log.info(`Exported ${backup.settings.length} settings, ${backup.customBooks.length} custom books, ${backup.progress.length} progress entries`)
  return backup
}

export async function importUserData(data: BackupData): Promise<{ success: boolean; error?: string }> {
  log.info('Starting user data import...')
  const transaction = await models.VocabularyBook.sequelize!.transaction()

  try {
    // 1. Import Settings
    if (data.settings && Array.isArray(data.settings)) {
      for (const setting of data.settings) {
        await models.UserSetting.upsert({
          id: setting.key, // Use key as ID for upsert
          key: setting.key,
          value: setting.value
        }, { transaction })
      }
    }

    // 2. Import Custom Books
    if (data.customBooks && Array.isArray(data.customBooks)) {
      for (const bookData of data.customBooks) {
        // Check if book exists
        const existingBook = await models.VocabularyBook.findByPk(bookData.id, { transaction })
        
        if (!existingBook) {
          // Create book
          const book = await models.VocabularyBook.create({
            id: bookData.id,
            name: bookData.name,
            description: bookData.description,
            category: bookData.category,
            language: bookData.language,
            wordCount: bookData.wordCount,
            isBuiltIn: false,
            sourceUrl: null,
            coverUrl: null,
            bookType: bookData.bookType as 'word' | 'sentence',
            chapterLength: bookData.chapterLength
          }, { transaction })

          // Create words
          // We generate NEW UUIDs for words, but keep the text
          const wordRecords = bookData.words.map(w => ({
            id: uuidv4(),
            vocabularyBookId: book.id,
            word: w.word,
            phonetic: w.phonetic,
            definition: w.definition,
            translation: w.translation,
            examples: w.examples,
            order: w.order
          }))
          
          await models.Word.bulkCreate(wordRecords, { transaction })
        } else {
           // If book exists, we assume it's fine. We don't overwrite custom books to avoid duplication or conflict
           // unless we want to force update. For now, skip.
           log.info(`Skipping existing custom book: ${bookData.name}`)
        }
      }
    }

    // 3. Import Progress
    if (data.progress && Array.isArray(data.progress)) {
      for (const p of data.progress) {
        // Find the word in the target book
        const word = await models.Word.findOne({
          where: {
            vocabularyBookId: p.vocabularyBookId,
            word: p.word
          },
          transaction
        })

        if (word) {
          // Find or create progress
          const [progress, created] = await models.WordProgress.findOrCreate({
            where: { wordId: word.id },
            defaults: {
              id: uuidv4(),
              wordId: word.id,
              vocabularyBookId: p.vocabularyBookId,
              correctCount: p.correctCount,
              wrongCount: p.wrongCount,
              lastPracticed: p.lastPracticed ? new Date(p.lastPracticed) : null,
              mastered: p.mastered,
              familiar: p.familiar
            },
            transaction
          })

          if (!created) {
            // Update existing progress - Merge stats
            // We take the MAX of counts or just overwrite?
            // "Restore" usually implies overwriting or merging.
            // Let's overwrite "familiar" if true (don't unmark if marked in backup), 
            // and maybe sum counts?
            // Simplest is to overwrite with backup data if it looks "newer" or "better".
            // Since this is a manual restore, the user probably wants the backup state.
            await progress.update({
              correctCount: p.correctCount,
              wrongCount: p.wrongCount,
              lastPracticed: p.lastPracticed ? new Date(p.lastPracticed) : progress.lastPracticed,
              mastered: p.mastered,
              familiar: p.familiar || progress.familiar // Keep familiar if already true
            }, { transaction })
          }
        } else {
          log.warn(`Could not find word "${p.word}" in book ${p.vocabularyBookId} for progress restore`)
        }
      }
    }

    await transaction.commit()
    log.info('User data import completed successfully')
    return { success: true }
  } catch (error) {
    await transaction.rollback()
    log.error('Failed to import user data:', error)
    return { success: false, error: String(error) }
  }
}
