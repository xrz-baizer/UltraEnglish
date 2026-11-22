import { Sequelize, DataTypes, Model, ModelStatic } from 'sequelize'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'
import type { GenerationOptions } from '../../shared/audio-generation'

let sequelize: Sequelize | null = null

// Model interfaces
export interface VocabularyBookAttributes {
  id: string
  name: string
  description: string | null
  category: string | null
  language: string
  wordCount: number
  isBuiltIn: boolean
  sourceUrl: string | null
  coverUrl: string | null
  bookType: 'word' | 'sentence'
  chapterLength: number
  createdAt?: Date
  updatedAt?: Date
}

export interface WordAttributes {
  id: string
  vocabularyBookId: string
  word: string
  phonetic: string | null
  definition: string
  translation: string | null
  examples: string | null
  audioUrl: string | null
  order: number
  createdAt?: Date
  updatedAt?: Date
}

export interface WordProgressAttributes {
  id: string
  wordId: string
  vocabularyBookId: string
  correctCount: number
  wrongCount: number
  lastPracticed: Date | null
  mastered: boolean
  familiar: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface PracticeRecordAttributes {
  id: string
  vocabularyBookId: string
  chapter: number
  totalWords: number
  correctCount: number
  wrongCount: number
  accuracy: number
  duration: number
  createdAt?: Date
}

export interface AudioAttributes {
  category?: string | null
  id: string
  name: string
  filePath: string
  duration: number | null
  format: string | null
  size: number | null
  createdAt?: Date
  updatedAt?: Date
}

export interface TranscriptionAttributes {
  id: string
  audioId: string
  language: string
  engine: string
  content: string
  segments: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface AudioGenerationAttributes {
  id: string
  filePath: string
  duration: number
  size: number
  options: GenerationOptions
  content: string
  segments: string
  importedAudioId?: string | null
  createdAt: Date
  updatedAt?: Date
}

export interface UserSettingAttributes {
  id: string
  key: string
  value: string
  createdAt?: Date
  updatedAt?: Date
}

// Model types
export type VocabularyBookModel = Model<VocabularyBookAttributes> & VocabularyBookAttributes
export type WordModel = Model<WordAttributes> & WordAttributes
export type WordProgressModel = Model<WordProgressAttributes> & WordProgressAttributes
export type PracticeRecordModel = Model<PracticeRecordAttributes> & PracticeRecordAttributes
export type AudioModel = Model<AudioAttributes> & AudioAttributes
export type AudioGenerationModel = Model<AudioGenerationAttributes> & AudioGenerationAttributes
export type TranscriptionModel = Model<TranscriptionAttributes> & TranscriptionAttributes
export type UserSettingModel = Model<UserSettingAttributes> & UserSettingAttributes

export interface AudioCategoryAttributes { id: string; name: string }
export type AudioCategoryModel = Model<AudioCategoryAttributes> & AudioCategoryAttributes

// Models container
export const models: {
  VocabularyBook: ModelStatic<VocabularyBookModel>
  Word: ModelStatic<WordModel>
  WordProgress: ModelStatic<WordProgressModel>
  PracticeRecord: ModelStatic<PracticeRecordModel>
  AudioCategory: ModelStatic<AudioCategoryModel>
  Audio: ModelStatic<AudioModel>
  AudioGeneration: ModelStatic<AudioGenerationModel>
  Transcription: ModelStatic<TranscriptionModel>
  UserSetting: ModelStatic<UserSettingModel>
} = {} as any

export async function initDatabase(): Promise<Sequelize> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'ultra-english.db')
  log.info('Database path:', dbPath)

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg) => log.debug(msg)
  })

  // Define VocabularyBook
  models.VocabularyBook = sequelize.define<VocabularyBookModel>('VocabularyBook', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    category: DataTypes.STRING,
    language: {
      type: DataTypes.STRING,
      defaultValue: 'en'
    },
    wordCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isBuiltIn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    sourceUrl: DataTypes.STRING,
    coverUrl: DataTypes.STRING,
    bookType: {
      type: DataTypes.STRING,
      defaultValue: 'word'
    },
    chapterLength: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    }
  }, {
    tableName: 'vocabulary_books'
  })

  // Define Word
  models.Word = sequelize.define<WordModel>('Word', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    vocabularyBookId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    word: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phonetic: DataTypes.STRING,
    definition: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    translation: DataTypes.TEXT,
    examples: DataTypes.TEXT,
    audioUrl: DataTypes.STRING,
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'words'
  })

  // Define WordProgress
  models.WordProgress = sequelize.define<WordProgressModel>('WordProgress', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    wordId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    vocabularyBookId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    correctCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    wrongCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastPracticed: DataTypes.DATE,
    mastered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    familiar: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'word_progress'
  })

  // Define PracticeRecord
  models.PracticeRecord = sequelize.define<PracticeRecordModel>('PracticeRecord', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    vocabularyBookId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    chapter: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    totalWords: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    correctCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    wrongCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    accuracy: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'practice_records',
    updatedAt: false
  })

  // Define Audio
  models.AudioCategory = sequelize.define<AudioCategoryModel>('AudioCategory', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: () => uuidv4() },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true }
  }, { tableName: 'audio_categories' })

  models.Audio = sequelize.define<AudioModel>('Audio', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: { type: DataTypes.STRING, allowNull: true },
    duration: DataTypes.FLOAT,
    format: DataTypes.STRING,
    size: DataTypes.INTEGER
  }, {
    tableName: 'audios'
  })

  models.AudioGeneration = sequelize.define<AudioGenerationModel>('AudioGeneration', {
    id: { type: DataTypes.STRING, primaryKey: true },
    filePath: { type: DataTypes.STRING, allowNull: false },
    duration: { type: DataTypes.FLOAT, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    options: { type: DataTypes.JSON, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    segments: { type: DataTypes.TEXT, allowNull: false },
    importedAudioId: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'audio_generations',
    indexes: [{ fields: ['createdAt', 'id'] }]
  })

  // Define Transcription
  models.Transcription = sequelize.define<TranscriptionModel>('Transcription', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    audioId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    language: {
      type: DataTypes.STRING,
      defaultValue: 'en'
    },
    engine: {
      type: DataTypes.STRING,
      defaultValue: 'whisper'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    segments: DataTypes.TEXT
  }, {
    tableName: 'transcriptions'
  })

  // Define UserSetting
  models.UserSetting = sequelize.define<UserSettingModel>('UserSetting', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'user_settings'
  })

  // Define associations
  models.VocabularyBook.hasMany(models.Word, { foreignKey: 'vocabularyBookId', as: 'words' })
  models.Word.belongsTo(models.VocabularyBook, { foreignKey: 'vocabularyBookId' })

  models.VocabularyBook.hasMany(models.WordProgress, { foreignKey: 'vocabularyBookId' })
  models.WordProgress.belongsTo(models.VocabularyBook, { foreignKey: 'vocabularyBookId' })

  models.Word.hasOne(models.WordProgress, { foreignKey: 'wordId' })
  models.WordProgress.belongsTo(models.Word, { foreignKey: 'wordId' })

  models.VocabularyBook.hasMany(models.PracticeRecord, { foreignKey: 'vocabularyBookId' })
  models.PracticeRecord.belongsTo(models.VocabularyBook, { foreignKey: 'vocabularyBookId' })

  models.Audio.hasOne(models.Transcription, { foreignKey: 'audioId', as: 'transcription' })
  models.Transcription.belongsTo(models.Audio, { foreignKey: 'audioId' })

  // Test connection and sync
  await sequelize.authenticate()
  log.info('Database connection established')

  await sequelize.sync()
  // Non-destructive addition for existing client databases.
  const audioTable = await sequelize.getQueryInterface().describeTable('audios')
  if (!('category' in audioTable)) await sequelize.getQueryInterface().addColumn('audios', 'category', { type: DataTypes.STRING, allowNull: true })

  for (const audio of await models.Audio.findAll({ attributes: ['category'], group: ['category'] })) {
    if (audio.category?.trim()) await models.AudioCategory.findOrCreate({ where: { name: audio.category.trim() }, defaults: { id: uuidv4(), name: audio.category.trim() } })
  }

  try {
    const queryInterface = sequelize.getQueryInterface()
    const table = await queryInterface.describeTable('vocabulary_books')
    if (!('bookType' in table)) {
      await queryInterface.addColumn('vocabulary_books', 'bookType', {
        type: DataTypes.STRING,
        defaultValue: 'word'
      })
      log.info('Added bookType column to vocabulary_books')
    }
    if (!('chapterLength' in table)) {
      await queryInterface.addColumn('vocabulary_books', 'chapterLength', {
        type: DataTypes.INTEGER,
        defaultValue: 100
      })
      log.info('Added chapterLength column to vocabulary_books')
    }
  } catch (error) {
    log.error('Failed to ensure vocabulary_books columns:', error)
  }

  try {
    const queryInterface = sequelize.getQueryInterface()
    const table = await queryInterface.describeTable('word_progress')
    if (!('familiar' in table)) {
      await queryInterface.addColumn('word_progress', 'familiar', {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      })
      log.info('Added familiar column to word_progress')
    }
  } catch (error) {
    log.error('Failed to ensure word_progress columns:', error)
  }

  log.info('Database synchronized')

  return sequelize
}

export function getDatabase(): Sequelize {
  if (!sequelize) {
    throw new Error('Database not initialized')
  }
  return sequelize
}

export async function closeDatabase(): Promise<void> {
  if (sequelize) {
    await sequelize.close()
    sequelize = null
    log.info('Database connection closed')
  }
}
