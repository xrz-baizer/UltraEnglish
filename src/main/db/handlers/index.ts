import { alignTextSubtitles } from '../../services/text-subtitle-alignment'
import { parseLrc } from '../../../shared/lrc-subtitles'
import { generateSentenceIpa } from '../../services/phonetics'
import type { TranscriptionSegment } from '../../../shared/audio-transcription'
import { MAX_AUDIO_NAME_LENGTH } from '../../../shared/audio-library'
import type { AudioResourceDetails, SelectedAudioFile } from '../../../shared/audio-library'
import { chooseStorageDirectory, getStoragePaths, getAudioStorageDirectory, getAudioPreferences, withAudioLibraryCopy } from '../../services/audio-storage'
import { ipcMain, dialog, BrowserWindow, shell, clipboard } from 'electron'
import type { OpenDialogOptions, WebContents } from 'electron'
import { models } from '../index'
import { importVocabularyFromFile } from '../seed'
import log from 'electron-log'
import { join, basename, extname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { LearningOverview } from '../../../shared/app-commands'
import { v4 as uuidv4 } from 'uuid'
import {
  WHISPER_MODELS,
  getDownloadedModels,
  getUserModelsDir,
  downloadModel,
  deleteModel,
  transcribeAudio,
  getBestAvailableModel
} from '../../services/whisper'

let importWindow: BrowserWindow | null = null
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'flac']

interface PendingAudioImport {
  file: SelectedAudioFile
  sourcePath: string
  format: string
  saving: boolean
}

function validateAudioName(value: string) {
  if (typeof value !== 'string' || value.trim().length > MAX_AUDIO_NAME_LENGTH || value.includes('\0')) {
    throw new Error('Invalid audio name')
  }
  return value.trim()
}

async function resolveAudioCategory(value: string, transaction: Transaction) {
  if (typeof value !== 'string' || value.trim().length > 80) throw new Error('Invalid category')
  const name = value.trim()
  if (!name) return null
  const record = await models.AudioCategory.findOne({ where: { name }, transaction })
  if (!record) throw new Error('Category unavailable')
  return record.name
}

const getPreloadPath = () => join(app.getAppPath(), 'app-build/preload/index.js')
const getRendererPath = () => join(app.getAppPath(), 'app-build/renderer/index.html')

export function registerIpcHandlers(): void {
  ipcMain.handle('clipboard-write-text', (_, text: string) => {
    if (typeof text !== 'string' || text.length > 1000000) throw new Error('Invalid clipboard text')
    clipboard.writeText(text)
  })
  ipcMain.handle('learning-overview', async (): Promise<LearningOverview> => {
    const [books, audiosCount, practicedWords, recent] = await Promise.all([
      models.VocabularyBook.findAll({ order: [['updatedAt', 'DESC']] }),
      models.Audio.count(),
      models.WordProgress.count({ where: { correctCount: { [Op.gt]: 0 } } }),
      models.PracticeRecord.findAll({ order: [['createdAt', 'DESC']], limit: 4 })
    ])
    const featured = books.find(book => book.id === recent[0]?.vocabularyBookId) || books[0]
    return {
      booksCount: books.length, audiosCount, practicedWords,
      featuredBook: featured ? { id: featured.id, name: featured.name, wordCount: featured.wordCount } : null,
      recentPractices: recent.map(record => ({
        id: record.id, bookId: record.vocabularyBookId,
        bookName: books.find(book => book.id === record.vocabularyBookId)?.name || '',
        chapter: record.chapter, totalWords: record.totalWords,
        createdAt: record.createdAt?.toISOString() || ''
      }))
    }
  })
  // Settings handlers
  ipcMain.handle('settings-get', async (_, { key }: { key: string }) => {
    const setting = await models.UserSetting.findOne({ where: { key } })
    if (setting) {
      try {
        return JSON.parse(setting.value)
      } catch {
        return setting.value
      }
    }
    return null
  })

  ipcMain.handle('settings-set', async (_, { key, value }: { key: string; value: unknown }) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    await models.UserSetting.upsert({
      id: key,
      key,
      value: stringValue
    })
    return true
  })

  ipcMain.handle('settings-get-all', async () => {
    const settings = await models.UserSetting.findAll()
    const result: Record<string, unknown> = {}
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value)
      } catch {
        result[setting.key] = setting.value
      }
    }
    return result
  })

  ipcMain.handle('settings-update', async (_, settings: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      await models.UserSetting.upsert({
        id: key,
        key,
        value: stringValue
      })
    }
    return true
  })

  // Vocabulary book handlers
  ipcMain.handle('vocabulary-books-find-all', async (_, { category }: { category?: string } = {}) => {
    const where = category ? { category } : {}
    const books = await models.VocabularyBook.findAll({ where, order: [['updatedAt', 'DESC']] })
    return books.map(book => book.get({ plain: true }))
  })

  ipcMain.handle('vocabulary-books-find-one', async (_, { id }: { id: string }) => {
    const book = await models.VocabularyBook.findByPk(id)
    return book ? book.get({ plain: true }) : null
  })

  ipcMain.handle('vocabulary-books-create', async (_, data: any) => {
    return await models.VocabularyBook.create(data)
  })

  ipcMain.handle('vocabulary-books-delete', async (_, { id }: { id: string }) => {
    const book = await models.VocabularyBook.findByPk(id)
    if (book && !book.isBuiltIn) {
      // Also delete related word progress
      await models.WordProgress.destroy({ where: { vocabularyBookId: id } })
      // Delete practice records
      await models.PracticeRecord.destroy({ where: { vocabularyBookId: id } })
      // Delete words
      await models.Word.destroy({ where: { vocabularyBookId: id } })
      // Delete the book
      await book.destroy()
      return true
    }
    return false
  })

  ipcMain.handle(
    'vocabulary-books-update',
    async (
      _,
      { id, ...data }: { id: string; name?: string; category?: string; chapterLength?: number }
    ) => {
      const book = await models.VocabularyBook.findByPk(id)
      if (book) {
        await book.update(data)
        return book.get({ plain: true })
      }
      return null
    }
  )

  ipcMain.handle('vocabulary-books-import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const filePath = result.filePaths[0]
    const importResult = await importVocabularyFromFile(filePath)

    if (importResult.success && importResult.bookId) {
      const book = await models.VocabularyBook.findByPk(importResult.bookId)
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('vocabulary-books-updated')
      })
      return { success: true, book }
    }

    return importResult
  })

  ipcMain.handle('vocabulary-books-open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    return { canceled: false, filePath: result.filePaths[0] }
  })

  ipcMain.handle('vocabulary-books-import-with-meta', async (_, data: { filePath: string; name: string; category: string; bookType: 'word' | 'sentence' }) => {
    const { filePath, name, category, bookType } = data
    const importResult = await importVocabularyFromFile(filePath, { name, category, bookType })

    if (importResult.success && importResult.bookId) {
      const book = await models.VocabularyBook.findByPk(importResult.bookId)
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('vocabulary-books-updated')
      })
      return { success: true, book: book?.get({ plain: true }) }
    }

    return importResult
  })

  ipcMain.handle('vocabulary-books-open-import-window', async (event) => {
    if (importWindow) {
      importWindow.focus()
      return true
    }

    const parent = BrowserWindow.fromWebContents(event.sender) || undefined

    importWindow = new BrowserWindow({
      width: 720,
      height: 560,
      minWidth: 680,
      minHeight: 520,
      useContentSize: true,
      center: true,
      backgroundColor: '#ffffff',
      resizable: false,
      show: false,
      parent,
      modal: !!parent,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },
      webPreferences: {
        preload: getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    importWindow.on('ready-to-show', () => {
      importWindow?.show()
    })

    importWindow.on('closed', () => {
      importWindow = null
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      importWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?window=import-vocabulary`)
    } else {
      importWindow.loadFile(getRendererPath(), { query: { window: 'import-vocabulary' } })
    }

    return true
  })

  ipcMain.handle('window-set-zoom', (event, { zoomFactor }: { zoomFactor: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const safeZoom = Math.min(3, Math.max(0.5, zoomFactor))
      win.webContents.setZoomFactor(safeZoom)
    }
    return true
  })

  // Word handlers
  ipcMain.handle('words-find', async (_, { vocabularyBookId, limit, offset }: { vocabularyBookId: string; limit?: number; offset?: number }) => {
    const words = await models.Word.findAll({
      where: { vocabularyBookId },
      order: [['order', 'ASC']],
      limit,
      offset
    })
    return words.map(word => word.get({ plain: true }))
  })

  ipcMain.handle('words-find-by-book', async (_, { vocabularyBookId, chapter, chapterLength = 50 }: { vocabularyBookId: string; chapter?: number; chapterLength?: number }) => {
    let limit: number | undefined
    let offset: number | undefined

    if (chapter !== undefined) {
      offset = (chapter - 1) * chapterLength
      limit = chapterLength
    }

    const words = await models.Word.findAll({
      where: { vocabularyBookId },
      order: [['order', 'ASC']],
      limit,
      offset
    })
    return words.map(word => word.get({ plain: true }))
  })

  // Word progress handlers
  ipcMain.handle('word-progress-update', async (_, { wordId, correct }: { wordId: string; correct: boolean }) => {
    const word = await models.Word.findByPk(wordId)
    if (!word) {
      throw new Error('Word not found')
    }

    let progress = await models.WordProgress.findOne({ where: { wordId } })
    if (!progress) {
      progress = await models.WordProgress.create({
        id: uuidv4(),
        wordId,
        vocabularyBookId: word.vocabularyBookId,
        correctCount: 0,
        wrongCount: 0,
        mastered: false,
        familiar: false
      })
    }

    if (correct) {
      await progress.update({
        correctCount: progress.correctCount + 1,
        lastPracticed: new Date(),
        mastered: progress.correctCount + 1 >= 1
      })
    } else {
      await progress.update({
        wrongCount: progress.wrongCount + 1,
        lastPracticed: new Date()
      })
    }

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('word-progress-updated')
    })

    return progress.get({ plain: true })
  })

  ipcMain.handle('word-progress-set-familiar', async (_, { wordId, familiar }: { wordId: string; familiar: boolean }) => {
    const word = await models.Word.findByPk(wordId)
    if (!word) {
      throw new Error('Word not found')
    }

    const [progress, created] = await models.WordProgress.findOrCreate({
      where: { wordId },
      defaults: {
        id: uuidv4(),
        wordId,
        vocabularyBookId: word.vocabularyBookId,
        correctCount: 0,
        wrongCount: 0,
        mastered: false,
        familiar
      }
    })

    if (!created) {
      log.info(`Updating existing progress ${progress.id} familiar to ${familiar}`)
      await progress.update({ familiar })
      // Reload to ensure we have latest data
      await progress.reload()
      log.info(`Updated progress ${progress.id} familiar is now ${progress.familiar}`)
    }

    log.info(`Set familiar=${familiar} for word=${wordId} (book=${word.vocabularyBookId}). Progress ID=${progress.id}`)

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('word-progress-updated')
    })

    return progress.get({ plain: true })
  })

  ipcMain.handle('word-progress-set-familiar-batch', async (_, { wordIds, familiar }: { wordIds: string[]; familiar: boolean }) => {
    if (!wordIds || wordIds.length === 0) return true

    // We need to fetch words first to get vocabularyBookId for new progress entries
    const words = await models.Word.findAll({ where: { id: wordIds } })
    if (words.length === 0) return true

    const wordMap = new Map(words.map(w => [w.id, w]))

    // Find existing progress
    const progresses = await models.WordProgress.findAll({ where: { wordId: wordIds } })
    const progressMap = new Map(progresses.map(p => [p.wordId, p]))

    const transaction = await models.WordProgress.sequelize?.transaction()

    try {
      for (const wordId of wordIds) {
        const word = wordMap.get(wordId)
        if (!word) continue

        let progress = progressMap.get(wordId)

        if (progress) {
             await progress.update({ familiar }, { transaction })
        } else {
             await models.WordProgress.create({
                id: uuidv4(),
                wordId,
                vocabularyBookId: word.vocabularyBookId,
                correctCount: 0,
                wrongCount: 0,
                mastered: false,
                familiar
              }, { transaction })
        }
      }
      await transaction?.commit()
    } catch (error) {
      await transaction?.rollback()
      throw error
    }

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('word-progress-updated')
    })

    return true
  })

  ipcMain.handle('word-progress-find', async (_, { vocabularyBookId }: { vocabularyBookId: string }) => {
    const results = await models.WordProgress.findAll({ where: { vocabularyBookId } })
    return results.map(p => p.get({ plain: true }))
  })

  ipcMain.handle('word-progress-chapter', async (_, { vocabularyBookId, chapterLength }: { vocabularyBookId: string; chapterLength: number }) => {
    // Get all progress for this book
    const progresses = await models.WordProgress.findAll({ where: { vocabularyBookId } })
    const words = await models.Word.findAll({
      where: { vocabularyBookId },
      order: [['order', 'ASC']]
    })

    // Calculate chapter progress
    const chapterCount = Math.ceil(words.length / chapterLength)
    const result = []

    for (let i = 0; i < chapterCount; i++) {
      const chapterWordIds = words
        .slice(i * chapterLength, (i + 1) * chapterLength)
        .map(w => w.id)

      const chapterProgress = progresses.filter(p => chapterWordIds.includes(p.wordId))
      const completed = chapterProgress.filter(p => p.mastered).length
      const totalCorrect = chapterProgress.reduce((sum, p) => sum + p.correctCount, 0)
      const totalWrong = chapterProgress.reduce((sum, p) => sum + p.wrongCount, 0)
      const total = totalCorrect + totalWrong

      result.push({
        chapter: i + 1,
        total: chapterWordIds.length,
        completed,
        accuracy: total > 0 ? Math.round((totalCorrect / total) * 100) : 0
      })
    }

    return result
  })

  ipcMain.handle('word-progress-reset', async (_, { vocabularyBookId, wordIds }: { vocabularyBookId: string; wordIds?: string[] }) => {
    const where: any = { vocabularyBookId }
    if (wordIds && wordIds.length > 0) {
      where.wordId = wordIds
    }
    await models.WordProgress.destroy({ where })

    // Notify renderers
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('word-progress-updated')
    })

    return true
  })

  // Practice record handlers
  ipcMain.handle('practice-records-create', async (_, data: any) => {
    return await models.PracticeRecord.create(data)
  })

  ipcMain.handle('practice-records-find', async (_, { vocabularyBookId, limit = 50 }: { vocabularyBookId?: string; limit?: number }) => {
    const where = vocabularyBookId ? { vocabularyBookId } : {}
    return await models.PracticeRecord.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit
    })
  })

  // Audio handlers
  ipcMain.handle('audios-find-all', async (_, { limit, offset }: { limit?: number; offset?: number } = {}) => {
    const audios = await models.Audio.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset
    })

    if (!audios.length) return []
    const transcriptions = await models.Transcription.findAll({
      attributes: ['audioId'],
      where: limit !== undefined || offset !== undefined
        ? { audioId: audios.map((audio) => audio.id) }
        : undefined
    })
    const transcribedIds = new Set(transcriptions.map((transcription) => transcription.audioId))
    return audios.map((audio) => ({
      ...audio.toJSON(),
      hasTranscription: transcribedIds.has(audio.id)
    }))
  })

  const categoryName = (value: string) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw new Error('Invalid category name')
    return value.trim()
  }
  ipcMain.handle('audio-categories-list', async () => (await models.AudioCategory.findAll({ order: [['name', 'ASC']] })).map(category => category.get({ plain: true })))
  ipcMain.handle('audio-categories-create', async (_, { name }: { name: string }) => (await models.AudioCategory.create({id: uuidv4(), name: categoryName(name)})).get({plain:true}))
  ipcMain.handle('audio-categories-rename', async (_, { id, name }: {id: string; name: string}) => {
    const next = categoryName(name)
    return models.Audio.sequelize!.transaction(async transaction => {
      const category = await models.AudioCategory.findByPk(id, {transaction})
      if (!category) throw new Error('Category unavailable')
      const old = category.name
      await category.update({name: next}, {transaction})
      await models.Audio.update({category: next}, {where: {category: old}, transaction})
      return category.get({plain:true})
    })
  })
  ipcMain.handle('audio-categories-delete', async (_, {id}: {id:string}) => models.Audio.sequelize!.transaction(async transaction => {
    const category = await models.AudioCategory.findByPk(id, {transaction})
    if (!category) throw new Error('Category unavailable')
    await models.Audio.update({category:null}, {where:{category:category.name},transaction})
    await category.destroy({transaction})
  }))

  ipcMain.handle('audios-update-category', async (_, { ids, category }: { ids: string[]; category: string }) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some(id => typeof id !== 'string')) throw new Error('Invalid category update')
    const sequelize = models.Audio.sequelize
    if (!sequelize) throw new Error('Database unavailable')
    return sequelize.transaction(async transaction => {
      const nextCategory = await resolveAudioCategory(category, transaction)
      const records = await models.Audio.findAll({ where: { id: ids }, transaction })
      if (records.length !== new Set(ids).size) throw new Error('Audio unavailable')
      await models.Audio.update({ category: nextCategory }, { where: { id: ids }, transaction })
      return records.length
    })
  })

  ipcMain.handle('audios-update-details', async (_, { id, name, category }: AudioResourceDetails & { id: string }) => {
    const nextName = validateAudioName(name)
    if (!nextName || typeof id !== 'string' || !id) throw new Error('Invalid audio details')
    await models.Audio.sequelize!.transaction(async (transaction) => {
      const audio = await models.Audio.findByPk(id, { transaction })
      if (!audio) throw new Error('Audio unavailable')
      const nextCategory = await resolveAudioCategory(category, transaction)
      await audio.update({ name: nextName, category: nextCategory }, { transaction })
    })
  })

  ipcMain.handle('audios-find-one', async (_, { id }: { id: string }) => {
    const audio = await models.Audio.findByPk(id)
    return audio ? { ...audio.get({ plain: true }), fileUrl: pathToFileURL(audio.filePath).href } : null
  })

  ipcMain.handle('audio-storage-paths', () => getStoragePaths())
  ipcMain.handle('audio-storage-choose', (_, { kind }: { kind: 'models' | 'audios' }) => chooseStorageDirectory(kind))

  ipcMain.handle('audios-open-storage-folder', async () => {
    const folder = await getAudioStorageDirectory()
    mkdirSync(folder, { recursive: true })
    return shell.openPath(folder)
  })

  const pendingAudioImports = new WeakMap<WebContents, PendingAudioImport>()
  ipcMain.handle('audios-select-file', async ({ sender }) => {
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: AUDIO_EXTENSIONS }]
    }
    const parent = BrowserWindow.fromWebContents(sender)
    const result = await (parent
      ? dialog.showOpenDialog(parent, options)
      : dialog.showOpenDialog(options))

    if (result.canceled || !result.filePaths.length || sender.isDestroyed()) return null
    const sourcePath = result.filePaths[0]
    const fileName = basename(sourcePath)
    const extension = extname(fileName)
    const format = extension.slice(1).toLowerCase()
    if (!AUDIO_EXTENSIONS.includes(format)) throw new Error('Unsupported audio format')

    const file = {
      token: uuidv4(),
      fileName,
      defaultName: basename(fileName, extension).trim() || fileName
    }
    pendingAudioImports.set(sender, { file, sourcePath, format, saving: false })
    return file
  })

  ipcMain.handle('audios-import', async ({ sender }, { token, name, category }: AudioResourceDetails & { token: string }) => {
    const pending = pendingAudioImports.get(sender)
    if (!pending || pending.file.token !== token || pending.saving) throw new Error('Audio selection unavailable')
    const audioName = validateAudioName(name) || pending.file.defaultName
    pending.saving = true
    const id = uuidv4()
    try {
      await withAudioLibraryCopy(id, pending.format, pending.sourcePath, async (filePath) => {
        await models.Audio.sequelize!.transaction(async (transaction) => {
          const nextCategory = await resolveAudioCategory(category, transaction)
          await models.Audio.create({
            id,
            name: audioName,
            category: nextCategory,
            filePath,
            format: pending.format
          }, { transaction })
        })
      })
      if (pendingAudioImports.get(sender) === pending) pendingAudioImports.delete(sender)
      return id
    } finally {
      pending.saving = false
    }
  })

  ipcMain.handle('audios-delete', async (_, { id }: { id: string }) => {
    const audio = await models.Audio.findByPk(id)
    if (audio) {
      // Delete transcription first
      await models.Transcription.destroy({ where: { audioId: id } })
      await audio.destroy()
      return true
    }
    return false
  })

  // Transcription handlers
  ipcMain.handle('transcription-find', async (_, { audioId }: { audioId: string }) => {
    const transcription = await models.Transcription.findOne({ where: { audioId } })
    if (transcription && transcription.segments) {
      return {
        ...transcription.toJSON(),
        segments: JSON.parse(transcription.segments)
      }
    }
    return transcription ? { ...transcription.toJSON(), segments: [] } : null
  })

  const generateTranscription = async (audioId: string, modelOverride?: string) => {
    const audio = await models.Audio.findByPk(audioId)
    if (!audio) {
      log.error('Audio not found:', audioId)
      return null
    }

    // Check if we have any model downloaded
    const audioSettings = await getAudioPreferences()
    if (modelOverride && !WHISPER_MODELS.some(model=>model.id===modelOverride)) return {error:'no_model'}
    const customModelPath = !modelOverride && typeof audioSettings.sttModelPath === 'string' ? audioSettings.sttModelPath : undefined
    const modelId = modelOverride || (typeof audioSettings.sttModelId === 'string' && audioSettings.sttModelId ? audioSettings.sttModelId : getBestAvailableModel())
    if (!modelId && !customModelPath?.trim()) {
      log.error('No Whisper model available. Please download a model first.')
      return { error: 'no_model', message: 'No Whisper model available. Please download a model in Settings.' }
    }

    log.info(`Transcribing audio ${audioId} with model ${modelId}`)

    try {
      const result = await transcribeAudio(audio.filePath, modelId || 'tiny', customModelPath)

      // Save transcription to database
      const existing = await models.Transcription.findOne({ where: { audioId } })
      const data = {
        id: existing?.id || uuidv4(),
        audioId,
        content: result.text,
        segments: JSON.stringify(result.segments),
        language: result.language,
        engine: 'whisper'
      }
      const transcription = existing ? await existing.update(data) : await models.Transcription.create(data)

      return {
        ...transcription.toJSON(),
        segments: result.segments
      }
    } catch (error) {
      log.error('Transcription error:', error)
      return { error: error instanceof Error && ['no_model', 'no_engine', 'no_ffmpeg', 'no_speech'].includes(error.message) ? error.message : 'transcription_error', message: String(error) }
    }
  }
  const transcriptionJobs = new Map<string, ReturnType<typeof generateTranscription>>()
  ipcMain.handle('transcription-generate', async (_, { audioId, modelId }: { audioId: string; modelId?: string }) => {
    const existing = transcriptionJobs.get(audioId)
    if (existing) return existing
    const job = generateTranscription(audioId, modelId)
    transcriptionJobs.set(audioId, job)
    try { return await job } finally { transcriptionJobs.delete(audioId) }
  })

  const ipaJobs = new Map<string, Promise<string>>()
  ipcMain.handle('sentence-ipa', async (_, { audioId, segmentId }: { audioId: string; segmentId: string }) => {
    const key = `${audioId}:${segmentId}`
    if (ipaJobs.has(key)) return ipaJobs.get(key)
    const job = (async () => {
      const audio = await models.Audio.findByPk(audioId)
      const transcript = await models.Transcription.findOne({ where: { audioId } })
      if (!audio || !transcript) throw new Error('Audio or subtitles unavailable')
      const segments: TranscriptionSegment[] = JSON.parse(transcript.segments || '[]')
      const segment = segments.find(item => item.id === segmentId)
      if (!segment) throw new Error('Sentence unavailable')
      if (segment.ipa) return segment.ipa
      const ipa = await generateSentenceIpa(audio.filePath, segment)
      // Reload before updating: generation must not overwrite concurrent subtitle edits.
      await transcript.reload()
      const latest: TranscriptionSegment[] = JSON.parse(transcript.segments || '[]')
      const target = latest.find(item => item.id === segmentId)
      if (!target || target.text !== segment.text || target.startTime !== segment.startTime || target.endTime !== segment.endTime) throw new Error('Sentence changed')
      target.ipa = ipa
      await transcript.update({ segments: JSON.stringify(latest) })
      return ipa
    })()
    ipaJobs.set(key, job)
    try { return await job } finally { ipaJobs.delete(key) }
  })

  ipcMain.handle('transcription-create', async (_, data: any) => {
    if (data.segments && typeof data.segments !== 'string') {
      data.segments = JSON.stringify(data.segments)
    }
    return await models.Transcription.create(data)
  })

  ipcMain.handle('transcription-update', async (_, { id, ...data }: { id: string; [key: string]: any }) => {
    const transcription = await models.Transcription.findByPk(id)
    if (transcription) {
      if (data.segments && typeof data.segments !== 'string') {
        data.segments = JSON.stringify(data.segments)
      }
      await transcription.update(data)
      return transcription.get({ plain: true })
    }
    return null
  })

  // STT Models handlers
  ipcMain.handle('stt-models-list', async () => {
    const downloaded = getDownloadedModels()
    return WHISPER_MODELS.map(model => ({
      ...model,
      downloaded: downloaded.includes(model.id)
    }))
  })

  ipcMain.handle('stt-models-path', async () => {
    return getUserModelsDir()
  })

  ipcMain.handle('stt-models-download', async (event, { modelId }: { modelId: string }) => {
    log.info('Model download requested:', modelId)

    // Get the window to send progress updates
    const win = BrowserWindow.fromWebContents(event.sender)

    const success = await downloadModel(modelId, (progress) => {
      // Send progress to renderer
      if (win && !win.isDestroyed()) {
        win.webContents.send('stt-model-download-progress', progress)
      }
    })

    return success
  })

  ipcMain.handle('stt-models-delete', async (_, { modelId }: { modelId: string }) => {
    log.info('Model delete requested:', modelId)
    return deleteModel(modelId)
  })

  // Shell handlers
  ipcMain.handle('open-folder', async (_, { folderPath }: { folderPath: string }) => {
    try {
      return await shell.openPath(folderPath)
    } catch (error) {
      log.error('Failed to open folder:', error)
      return 'Failed to open folder'
    }
  })

  // Subtitle import handler
  const pastedTextJobs = new Set<string>()
  ipcMain.handle('subtitle-align-text', async (_, {audioId,text}: {audioId:string;text:string}) => {
    if (transcriptionJobs.has(audioId) || pastedTextJobs.has(audioId)) return {error:'transcription_busy'}
    if (typeof text!=='string' || !text.trim() || text.length>200000) return {error:'alignment_failed'}
    const audio=await models.Audio.findByPk(audioId)
    if(!audio)return {error:'audio_unavailable'}
    pastedTextJobs.add(audioId)
    try {
      const segments=await alignTextSubtitles(audio.filePath,text)
      segments.forEach(segment=>{segment.id=uuidv4()})
      const existing=await models.Transcription.findOne({where:{audioId}})
      const data={id:existing?.id||uuidv4(),audioId,content:segments.map(segment=>segment.text).join(' '),segments:JSON.stringify(segments),language:'en',engine:'echogarden-dtw'}
      const transcript=existing?await existing.update(data):await models.Transcription.create(data)
      return {...transcript.get({plain:true}),segments}
    }catch(error){log.error('Pasted subtitle alignment failed:',error);return {error:'alignment_failed'}}
    finally{pastedTextJobs.delete(audioId)}
  })

  ipcMain.handle('subtitle-import', async (_, { audioId, duration }: { audioId: string; duration?: number }) => {
    const audio = await models.Audio.findByPk(audioId)
    if (!audio) return {error:'audio_unavailable'}
    if (transcriptionJobs.has(audioId)) return { error: 'transcription_busy' }
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Subtitle Files', extensions: ['lrc', 'srt', 'vtt', 'txt'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8').replace(/\r\n?/g, '\n')
    const ext = extname(filePath).toLowerCase()

    // Parse subtitle file
    const segments: TranscriptionSegment[] = []

    if (ext === '.txt') {
      try { segments.push(...await alignTextSubtitles(audio.filePath, content)) } catch (error) { log.error('Text subtitle alignment failed:', error); return {error:'alignment_failed'} }
    } else if (ext === '.lrc') {
      segments.push(...parseLrc(content, Number.isFinite(duration) && duration! > 0 ? duration : audio.duration || undefined))
    } else if (ext === '.srt') {
      // Parse SRT format
      const blocks = content.trim().split(/\n\n+/)
      for (const block of blocks) {
        const lines = block.split('\n')
        if (lines.length < 3) continue

        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
        if (!timeMatch) continue

        const startTime =
          parseInt(timeMatch[1] || '0') * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000
        const endTime =
          parseInt(timeMatch[5] || '0') * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000

        const text = lines.slice(2).join(' ').trim()
        if (text) {
          segments.push({
            id: `seg-${segments.length}`,
            startTime,
            endTime,
            text
          })
        }
      }
    } else if (ext === '.vtt') {
      // Parse VTT format
      const lines = content.split('\n')
      let i = 0
      // Skip header
      while (i < lines.length && !lines[i].includes('-->')) i++

      while (i < lines.length) {
        const line = lines[i].trim()
        const timeMatch = line.match(/(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})/)
        if (timeMatch) {
          const startTime =
            parseInt(timeMatch[1] || '0') * 3600 +
            parseInt(timeMatch[2]) * 60 +
            parseInt(timeMatch[3]) +
            parseInt(timeMatch[4]) / 1000
          const endTime =
            parseInt(timeMatch[5] || '0') * 3600 +
            parseInt(timeMatch[6]) * 60 +
            parseInt(timeMatch[7]) +
            parseInt(timeMatch[8]) / 1000

          i++
          const textLines: string[] = []
          while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
            textLines.push(lines[i].trim())
            i++
          }

          const text = textLines.join(' ')
          if (text) {
            segments.push({
              id: `seg-${segments.length}`,
              startTime,
              endTime,
              text
            })
          }
        } else {
          i++
        }
      }
    }

    if (segments.length === 0) {
      return { error: 'parse_failed', message: 'Failed to parse subtitle file' }
    }

    // Fresh IDs keep notes on old subtitles from attaching to unrelated imported cues.
    segments.forEach(segment => {segment.id = uuidv4()})
    // Save to database
    try {
      const existing = await models.Transcription.findOne({ where: { audioId } })
      const data = {
        id: existing?.id || uuidv4(),
        audioId,
        content: segments.map((s) => s.text).join(' '),
        segments: JSON.stringify(segments),
        language: 'unknown',
        engine: ext === '.txt' ? 'echogarden-dtw' : ext.slice(1)
      }
      const transcription = existing ? await existing.update(data) : await models.Transcription.create(data)

      return {
        ...transcription.toJSON(),
        segments
      }
    } catch (error) {
      log.error('Failed to save transcription:', error)
      return { error: 'save_failed', message: 'Failed to save transcription' }
    }
  })

  ipcMain.handle(
    'save-text-file',
    async (
      _,
      {
        content,
        suggestedName,
        filters
      }: { content: string; suggestedName: string; filters?: Electron.FileFilter[] }
    ) => {
      try {
        const defaultPath = join(app.getPath('downloads'), suggestedName)
        const result = await dialog.showSaveDialog({
          defaultPath,
          filters: filters || [{ name: 'JSON Files', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }
        writeFileSync(result.filePath, content, 'utf-8')
        return { canceled: false, filePath: result.filePath }
      } catch (error) {
        log.error('Failed to save file:', error)
        return { canceled: true, error: 'Failed to save file' }
      }
    }
  )

  ipcMain.handle(
    'save-text-file-to-downloads',
    async (
      _,
      { content, suggestedName }: { content: string; suggestedName: string }
    ) => {
      try {
        const downloadsDir = app.getPath('downloads')
        const ext = extname(suggestedName)
        const base = ext ? suggestedName.slice(0, -ext.length) : suggestedName
        let targetPath = join(downloadsDir, suggestedName)
        let counter = 1
        while (existsSync(targetPath)) {
          const nextName = `${base} (${counter})${ext}`
          targetPath = join(downloadsDir, nextName)
          counter += 1
        }
        writeFileSync(targetPath, content, 'utf-8')
        return { success: true, filePath: targetPath }
      } catch (error) {
        log.error('Failed to save file to downloads:', error)
        return { success: false, error: 'Failed to save file' }
      }
    }
  )

  // Auth handlers (placeholder - will connect to backend)
  ipcMain.handle('auth-login', async (_, { email }: { email: string; password: string }) => {
    // TODO: Implement with backend
    log.info('Login attempt:', email)
    return { success: false, message: 'Backend not implemented yet' }
  })

  ipcMain.handle('auth-register', async (_, { email }: { name: string; email: string; password: string }) => {
    // TODO: Implement with backend
    log.info('Register attempt:', email)
    return { success: false, message: 'Backend not implemented yet' }
  })

  ipcMain.handle('auth-logout', async () => {
    // TODO: Implement
    return
  })

  ipcMain.handle('auth-current-user', async () => {
    // TODO: Implement
    return null
  })

  log.info('IPC handlers registered')
}
