import { models } from './index'
import { app } from 'electron'
import { join, basename } from 'path'
import { readFileSync, existsSync } from 'fs'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'

// Legacy format (old UltraEnglish format)
interface LegacyWord {
  word: string
  phonetic: string | null
  definition: string
  translation: string | null
}

interface LegacyDictionaryData {
  id: string
  name: string
  nameZh?: string
  description: string
  descriptionZh?: string
  category: string
  language: string
  words: LegacyWord[]
}

// qwerty-learner format
interface QwertyWord {
  name: string
  trans: string[]
  usphone?: string
  ukphone?: string
  examples?: string[]
}

// Dictionary config format
interface DictionaryConfig {
  id: string
  name: string
  nameZh?: string
  description: string
  descriptionZh?: string
  category: string
  url: string
  length: number
  chapterLength?: number
  language: string
  bookType?: 'word' | 'sentence'
}

interface DictionariesConfig {
  dictionaries: DictionaryConfig[]
}

// Normalized word for database
interface NormalizedWord {
  word: string
  phonetic: string | null
  definition: string
  translation: string | null
  examples: string | null
}

interface ImportOverrides {
  name?: string
  category?: string
  bookType?: 'word' | 'sentence'
}

/**
 * Detect format of dictionary data
 */
function detectFormat(data: unknown): 'qwerty' | 'legacy' {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0]
    if (typeof first === 'object' && first !== null && 'name' in first && 'trans' in first) {
      return 'qwerty'
    }
  }
  return 'legacy'
}

/**
 * Normalize a word from either format to database format
 */
function normalizeWord(word: QwertyWord | LegacyWord): NormalizedWord {
  if ('name' in word) {
    // qwerty-learner format
    const qword = word as QwertyWord
    return {
      word: qword.name,
      phonetic: qword.usphone || qword.ukphone || null,
      definition: qword.trans.join('\n') || '',
      translation: qword.trans[0] || null,
      examples: qword.examples ? JSON.stringify(qword.examples) : null
    }
  }
  // legacy format
  const lword = word as LegacyWord
  return {
    word: lword.word,
    phonetic: lword.phonetic,
    definition: lword.definition,
    translation: lword.translation,
    examples: null
  }
}

/**
 * Get the path to the built-in dictionaries
 * In development, this is in the assets folder
 * In production, this is in the app's resources
 */
function getDictionariesPath(): string {
  if (app.isPackaged) {
    // Production: resources are in the app's resources directory
    return join(process.resourcesPath, 'dictionaries')
  } else {
    return join(app.getAppPath(), 'assets', 'dictionaries')
  }
}

/**
 * Clear all built-in vocabulary books and their words
 * Used when reseeding is needed after format changes
 */
export async function clearBuiltInDictionaries(): Promise<void> {
  try {
    // Find all built-in books
    const builtInBooks = await models.VocabularyBook.findAll({ where: { isBuiltIn: true } })

    for (const book of builtInBooks) {
      // Delete words for this book
      await models.Word.destroy({ where: { vocabularyBookId: book.id } })
      // Delete word progress for this book
      await models.WordProgress.destroy({ where: { vocabularyBookId: book.id } })
      // Delete the book
      await book.destroy()
    }

    log.info(`Cleared ${builtInBooks.length} built-in dictionaries`)
  } catch (error) {
    log.error('Failed to clear built-in dictionaries:', error)
  }
}

/**
 * Seed the database with built-in vocabulary books
 * Reads from dictionaries-config.json for metadata
 */
export async function seedBuiltInDictionaries(): Promise<void> {
  try {
    // These two requested defaults move to IELTS; preserve their existing word IDs and progress.
    await models.VocabularyBook.update({ category: '雅思' }, {
      where: { isBuiltIn: true, id: { [Op.in]: ['ielts-wang-5', 'ielts-wang-11'] } }
    })
    const retirementKey = 'retired-library-categories-v1'
    if (!await models.UserSetting.findOne({ where: { key: retirementKey } })) {
      await models.VocabularyBook.sequelize!.transaction(async transaction => {
        await models.VocabularyBook.update({ category: '其他' }, {
          where: {
            isBuiltIn: true,
            id: { [Op.in]: ['basic-vocabulary', 'coca-3000-6000', 'reading-core'] },
            category: { [Op.in]: ['必背', '只读'] }
          },
          transaction
        })
        const books = await models.VocabularyBook.findAll({ where: { [Op.or]: [
          { category: { [Op.in]: ['必背', '只读'] } },
          { isBuiltIn: true, id: { [Op.in]: ['listening-core', 'coca-3000', 'sentence-pattern'] } }
        ] }, transaction })
        for (const book of books) {
          const where = { vocabularyBookId: book.id }
          await models.PracticeRecord.destroy({ where, transaction })
          await models.WordProgress.destroy({ where, transaction })
          await models.Word.destroy({ where, transaction })
          await book.destroy({ transaction })
        }
        const setting = await models.UserSetting.findOne({ where: { key: 'vocabulary' }, transaction })
        if (setting) {
          const value = JSON.parse(setting.value)
          value.customCategories = (value.customCategories || []).filter((name: string) => !['必背', '只读'].includes(name))
          await setting.update({ value: JSON.stringify(value) }, { transaction })
        }
        await models.UserSetting.create({ id: retirementKey, key: retirementKey, value: 'true' }, { transaction })
      })
    }
    const dictionariesPath = getDictionariesPath()
    log.info('Looking for dictionaries at:', dictionariesPath)

    if (!existsSync(dictionariesPath)) {
      log.warn('Dictionaries path does not exist:', dictionariesPath)
      return
    }

    const configPath = join(dictionariesPath, 'dictionaries-config.json')

    if (!existsSync(configPath)) {
      log.warn('dictionaries-config.json not found:', configPath)
      return
    }

    const configContent = readFileSync(configPath, 'utf-8')
    const config: DictionariesConfig = JSON.parse(configContent)

    if (!config.dictionaries || config.dictionaries.length === 0) {
      log.warn('No dictionaries configured in dictionaries-config.json')
      return
    }

    // Clear old built-in dictionaries first to ensure fresh data
    // WARNING: This deletes user progress! Do not uncomment unless you implement a migration strategy.
    // await clearBuiltInDictionaries()

    let importedCount = 0
    let skippedCount = 0

    for (const dictConfig of config.dictionaries) {
      try {
        // Check if this specific dictionary already exists by ID
        const existingBook = await models.VocabularyBook.findByPk(dictConfig.id)

        if (existingBook) {
          log.info(`Dictionary already exists, skipping: ${dictConfig.name} (${dictConfig.id})`)
          skippedCount++
          continue
        }

        // Load the word file
        const wordFilePath = join(dictionariesPath, dictConfig.url)
        if (!existsSync(wordFilePath)) {
          log.error(`Word file not found: ${wordFilePath}`)
          continue
        }

        const wordContent = readFileSync(wordFilePath, 'utf-8')
        const wordData = JSON.parse(wordContent)

        const format = detectFormat(wordData)
        let words: NormalizedWord[]

        if (format === 'qwerty') {
          const qwertyWords = (wordData as QwertyWord[]).filter(
            (entry) => Array.isArray(entry.trans) && entry.trans.length > 0
          )
          words = qwertyWords.map(normalizeWord)
        } else {
          // Legacy format - words are in the data.words array
          const legacyData = wordData as LegacyDictionaryData
          words = legacyData.words.map(normalizeWord)
        }

        // Create the vocabulary book
        const book = await models.VocabularyBook.create({
          id: dictConfig.id,
          name: dictConfig.name,
          description: dictConfig.description,
          category: dictConfig.category,
          language: dictConfig.language,
          wordCount: words.length,
          isBuiltIn: true,
          sourceUrl: null,
          coverUrl: null,
          bookType: dictConfig.bookType || 'word',
          chapterLength: dictConfig.chapterLength ?? dictConfig.length ?? 100
        })

        // Create words in batches to avoid memory issues
        const batchSize = 100
        for (let i = 0; i < words.length; i += batchSize) {
          const batch = words.slice(i, i + batchSize)

          const wordRecords = batch.map((word, index) => ({
            id: uuidv4(),
            vocabularyBookId: book.id,
            word: word.word,
            phonetic: word.phonetic,
            definition: word.definition,
            translation: word.translation,
            examples: word.examples,
            audioUrl: null,
            order: i + index
          }))

          await models.Word.bulkCreate(wordRecords)
        }

        log.info(`Imported dictionary: ${dictConfig.name} (${dictConfig.id}) with ${words.length} words`)
        importedCount++
      } catch (error) {
        log.error(`Failed to import dictionary ${dictConfig.id}:`, error)
      }
    }

    log.info(`Built-in dictionaries seed completed: ${importedCount} imported, ${skippedCount} skipped`)
  } catch (error) {
    log.error('Failed to seed built-in dictionaries:', error)
  }
}

/**
 * Import a vocabulary book from a JSON file path
 * Supports both qwerty-learner format and legacy format
 */
export async function importVocabularyFromFile(
  filePath: string,
  overrides: ImportOverrides = {}
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  try {
    if (!existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }

    const content = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    const format = detectFormat(data)
    let words: NormalizedWord[]
    let name: string
    let description: string
    let category: string
    let language: string
    let bookType: 'word' | 'sentence' = overrides.bookType || 'word'

    if (format === 'qwerty') {
      // qwerty-learner format: flat array of words
      const qwertyWords = (data as QwertyWord[]).filter(
        (entry) => Array.isArray(entry.trans) && entry.trans.length > 0
      )

      if (!Array.isArray(qwertyWords) || qwertyWords.length === 0) {
        return { success: false, error: 'Invalid dictionary format: empty or not an array' }
      }

      words = qwertyWords.map(normalizeWord)

      // Extract name from filename
      const fileName = basename(filePath, '.json')
      name = fileName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      description = `Imported from ${basename(filePath)}`
      category = 'custom'
      language = 'en'
    } else {
      // Legacy format: object with metadata and words array
      const legacyData = data as LegacyDictionaryData

      if (!legacyData.words || !Array.isArray(legacyData.words) || legacyData.words.length === 0) {
        return { success: false, error: 'Invalid dictionary format: missing or empty words array' }
      }

      words = legacyData.words.map(normalizeWord)
      name = legacyData.name || basename(filePath, '.json')
      description = legacyData.description || ''
      category = legacyData.category || 'custom'
      language = legacyData.language || 'en'
    }

    if (overrides.name) name = overrides.name
    if (overrides.category) category = overrides.category

    // Generate a new ID for user-imported books
    const bookId = uuidv4()

    // Create the vocabulary book
    const book = await models.VocabularyBook.create({
      id: bookId,
      name,
      description,
      category,
      language,
      wordCount: words.length,
      isBuiltIn: false,
      sourceUrl: null,
      coverUrl: null,
      bookType,
      chapterLength: 100
    })

    // Create words in batches
    const batchSize = 100
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize)

      const wordRecords = batch.map((word, index) => ({
        id: uuidv4(),
        vocabularyBookId: book.id,
        word: word.word,
        phonetic: word.phonetic || null,
        definition: word.definition || '',
        translation: word.translation || null,
        examples: word.examples,
        audioUrl: null,
        order: i + index
      }))

      await models.Word.bulkCreate(wordRecords)
    }

    log.info(`Imported vocabulary from file: ${name} with ${words.length} words`)
    return { success: true, bookId: book.id }
  } catch (error) {
    log.error('Failed to import vocabulary from file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
