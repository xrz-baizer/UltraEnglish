import { contextBridge, ipcRenderer } from 'electron'
import type { AppCommand, LearningOverview, WindowAppearance } from '../shared/app-commands'
import type { AudioResourceDetails, SelectedAudioFile } from '../shared/audio-library'
import { AUDIO_GENERATION_PROGRESS, GENERATION_RESOURCES_CHANGED } from '../shared/audio-generation'
import type { GenerationDirectory, GenerationDownload, GenerationOptions, GeneratedAudio, GenerationPaths, GenerationSaveLocation, GenerationResourceId, GenerationResourceSnapshot, GenerationState } from '../shared/audio-generation'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAudioGenerationPaths: () => ipcRenderer.invoke('audio-generation-paths'),
  chooseAudioGenerationPath: (kind: GenerationDirectory) => ipcRenderer.invoke('audio-generation-choose-path', kind),
  resetAudioGenerationPath: (kind: GenerationDirectory) => ipcRenderer.invoke('audio-generation-reset-path', kind),
  getAudioGenerationState: () => ipcRenderer.invoke('audio-generation-state'),
  getAudioGenerationHistory: () => ipcRenderer.invoke('audio-generation-history'),
  getAudioGenerationSaveLocation: () => ipcRenderer.invoke('audio-generation-save-location'),
  chooseAudioGenerationSaveLocation: (token?: string) => ipcRenderer.invoke('audio-generation-select-save-location', token),
  startAudioGeneration: (text: string, options: GenerationOptions, name: string, locationToken?: string) =>
    ipcRenderer.invoke('audio-generation-start', text, options, name, locationToken),
  getAudioGenerationResources: () => ipcRenderer.invoke('audio-generation-resources'),
  downloadAudioGenerationResources: (ids: GenerationResourceId[]) => ipcRenderer.invoke('audio-generation-download', ids),
  onAudioGenerationResourcesChanged: (callback: (download: GenerationDownload | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, download: GenerationDownload | null) => callback(download)
    ipcRenderer.on(GENERATION_RESOURCES_CHANGED, listener)
    return () => ipcRenderer.removeListener(GENERATION_RESOURCES_CHANGED, listener)
  },
  cancelAudioGenerationDownload: () => ipcRenderer.invoke('audio-generation-cancel-download'),
  retryGeneratedAudioSave: (fallback?: 'wav', locationToken?: string) => ipcRenderer.invoke('audio-generation-retry-save', fallback, locationToken),
  previewGeneratedAudio: (id: string) => ipcRenderer.invoke('audio-generation-preview', id),
  readGeneratedLibraryAudio: (id: string) => ipcRenderer.invoke('audio-generation-preview-library-audio', id),
  revealGeneratedAudio: (id: string) => ipcRenderer.invoke('audio-generation-reveal', id),
  importGeneratedAudio: (id: string) => ipcRenderer.invoke('audio-generation-import', id),
  onAudioGenerationProgress: (callback: (state: GenerationState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: GenerationState) => callback(state)
    ipcRenderer.on(AUDIO_GENERATION_PROGRESS, listener)
    return () => ipcRenderer.removeListener(AUDIO_GENERATION_PROGRESS, listener)
  },
  alignSubtitleText: (audioId: string, text: string) => ipcRenderer.invoke('subtitle-align-text', {audioId,text}),
  getAudioCategories: () => ipcRenderer.invoke('audio-categories-list'),
  createAudioCategory: (name: string) => ipcRenderer.invoke('audio-categories-create', {name}),
  renameAudioCategory: (id: string, name: string) => ipcRenderer.invoke('audio-categories-rename', {id,name}),
  deleteAudioCategory: (id: string) => ipcRenderer.invoke('audio-categories-delete', {id}),
  updateAudioCategory: (ids: string[], category: string) => ipcRenderer.invoke('audios-update-category', { ids, category }),
  writeClipboardText: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
  getAppVersion: () => ipcRenderer.invoke('app-get-version'),
  getLearningOverview: () => ipcRenderer.invoke('learning-overview'),
  getWindowAppearance: () => ipcRenderer.invoke('window-get-appearance'),
  setWindowAppearance: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('window-set-appearance', theme),
  onAppCommand: (callback: (command: AppCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: AppCommand) => callback(command)
    ipcRenderer.on('app-command', listener)
    return () => ipcRenderer.removeListener('app-command', listener)
  },
  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings-get', { key }),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings-set', { key, value }),
  getSettings: () => ipcRenderer.invoke('settings-get-all'),
  updateSettings: (settings: unknown) => ipcRenderer.invoke('settings-update', settings),

  // Vocabulary books
  getVocabularyBooks: (category?: string) => ipcRenderer.invoke('vocabulary-books-find-all', { category }),
  getVocabularyBookById: (id: string) => ipcRenderer.invoke('vocabulary-books-find-one', { id }),
  createVocabularyBook: (data: unknown) => ipcRenderer.invoke('vocabulary-books-create', data),
  updateVocabularyBook: (id: string, data: { name?: string; category?: string; chapterLength?: number }) =>
    ipcRenderer.invoke('vocabulary-books-update', { id, ...data }),
  deleteVocabularyBook: (id: string) => ipcRenderer.invoke('vocabulary-books-delete', { id }),
  importVocabularyBook: () => ipcRenderer.invoke('vocabulary-books-import'),
  openVocabularyImportWindow: () => ipcRenderer.invoke('vocabulary-books-open-import-window'),
  selectVocabularyBookFile: () => ipcRenderer.invoke('vocabulary-books-open-file'),
  importVocabularyBookWithMeta: (data: { filePath: string; name: string; category: string; bookType: 'word' | 'sentence' }) =>
    ipcRenderer.invoke('vocabulary-books-import-with-meta', data),

  // Words
  getWords: (vocabularyBookId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke('words-find', { vocabularyBookId, limit, offset }),
  getWordsByBook: (vocabularyBookId: string, chapter?: number, chapterLength?: number) =>
    ipcRenderer.invoke('words-find-by-book', { vocabularyBookId, chapter, chapterLength }),

  // Word progress
  updateWordProgress: (wordId: string, correct: boolean) =>
    ipcRenderer.invoke('word-progress-update', { wordId, correct }),
  setWordFamiliar: (wordId: string, familiar: boolean) =>
    ipcRenderer.invoke('word-progress-set-familiar', { wordId, familiar }),
  setWordFamiliarBatch: (wordIds: string[], familiar: boolean) =>
    ipcRenderer.invoke('word-progress-set-familiar-batch', { wordIds, familiar }),
  getWordProgress: (vocabularyBookId: string) =>
    ipcRenderer.invoke('word-progress-find', { vocabularyBookId }),
  getChapterProgress: (vocabularyBookId: string, chapterLength: number) =>
    ipcRenderer.invoke('word-progress-chapter', { vocabularyBookId, chapterLength }),
  resetWordProgress: (vocabularyBookId: string, wordIds?: string[]) =>
    ipcRenderer.invoke('word-progress-reset', { vocabularyBookId, wordIds }),

  // Practice records
  createPracticeRecord: (data: unknown) => ipcRenderer.invoke('practice-records-create', data),
  getPracticeRecords: (vocabularyBookId?: string, limit?: number) =>
    ipcRenderer.invoke('practice-records-find', { vocabularyBookId, limit }),

  // Audios
  getAudios: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('audios-find-all', { limit, offset }),
  getAudioById: (id: string) => ipcRenderer.invoke('audios-find-one', { id }),
  selectAudioFile: () => ipcRenderer.invoke('audios-select-file'),
  importAudio: (token: string, details: AudioResourceDetails) =>
    ipcRenderer.invoke('audios-import', { token, ...details }),
  updateAudioDetails: (id: string, details: AudioResourceDetails) =>
    ipcRenderer.invoke('audios-update-details', { id, ...details }),
  openAudioStorageFolder: () => ipcRenderer.invoke('audios-open-storage-folder'),
  getAudioStoragePaths: () => ipcRenderer.invoke('audio-storage-paths'),
  chooseAudioStorageDirectory: (kind: 'models' | 'audios') => ipcRenderer.invoke('audio-storage-choose', { kind }),
  deleteAudio: (id: string) => ipcRenderer.invoke('audios-delete', { id }),

  // Transcriptions
  getTranscription: (audioId: string) => ipcRenderer.invoke('transcription-find', { audioId }),
  generateSentenceIpa: (audioId: string, segmentId: string) => ipcRenderer.invoke('sentence-ipa', { audioId, segmentId }),
  transcribeAudio: (audioId: string, modelId?: string) => ipcRenderer.invoke('transcription-generate', { audioId, modelId }),
  createTranscription: (data: unknown) => ipcRenderer.invoke('transcription-create', data),
  updateTranscription: (id: string, data: unknown) =>
    ipcRenderer.invoke('transcription-update', { id, ...data as object }),

  // STT Models
  getDownloadedModels: () => ipcRenderer.invoke('stt-models-list'),
  getSttModelsPath: () => ipcRenderer.invoke('stt-models-path'),
  downloadSttModel: (modelId: string) => ipcRenderer.invoke('stt-models-download', { modelId }),
  deleteSttModel: (modelId: string) => ipcRenderer.invoke('stt-models-delete', { modelId }),

  // Shell
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', { folderPath }),
  saveTextFile: (data: { content: string; suggestedName: string; filters?: Electron.FileFilter[] }) =>
    ipcRenderer.invoke('save-text-file', data),
  saveTextFileToDownloads: (data: { content: string; suggestedName: string }) =>
    ipcRenderer.invoke('save-text-file-to-downloads', data),

  // Subtitle
  importSubtitle: (audioId: string, duration?: number) => ipcRenderer.invoke('subtitle-import', { audioId, duration }),

  // Auth
  login: (email: string, password: string) => ipcRenderer.invoke('auth-login', { email, password }),
  register: (name: string, email: string, password: string) =>
    ipcRenderer.invoke('auth-register', { name, email, password }),
  logout: () => ipcRenderer.invoke('auth-logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth-current-user'),

  // Window
  setZoomFactor: (zoomFactor: number) => ipcRenderer.invoke('window-set-zoom', { zoomFactor }),

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
})

// Type definitions for the exposed API
export interface ElectronAPI {
  getAudioGenerationPaths: () => Promise<GenerationPaths>
  chooseAudioGenerationPath: (kind: GenerationDirectory) => Promise<GenerationPaths | null>
  resetAudioGenerationPath: (kind: GenerationDirectory) => Promise<GenerationPaths>
  getAudioGenerationState: () => Promise<{ state: GenerationState; text: string; options: GenerationOptions }>
  getAudioGenerationHistory: () => Promise<GeneratedAudio[]>
  getAudioGenerationSaveLocation: () => Promise<GenerationSaveLocation>
  chooseAudioGenerationSaveLocation: (token?: string) => Promise<GenerationSaveLocation | null>
  startAudioGeneration: (text: string, options: GenerationOptions, name: string, locationToken?: string) => Promise<void>
  getAudioGenerationResources: () => Promise<GenerationResourceSnapshot>
  downloadAudioGenerationResources: (ids: GenerationResourceId[]) => Promise<void>
  onAudioGenerationResourcesChanged: (callback: (download: GenerationDownload | null) => void) => () => void
  cancelAudioGenerationDownload: () => Promise<void>
  retryGeneratedAudioSave: (fallback?: 'wav', locationToken?: string) => Promise<void>
  previewGeneratedAudio: (id: string) => Promise<Uint8Array<ArrayBuffer>>
  readGeneratedLibraryAudio: (id: string) => Promise<Uint8Array<ArrayBuffer>>
  revealGeneratedAudio: (id: string) => Promise<void>
  importGeneratedAudio: (id: string) => Promise<string>
  onAudioGenerationProgress: (callback: (state: GenerationState) => void) => () => void
  getAppVersion: () => Promise<string>
  getLearningOverview: () => Promise<LearningOverview>
  getWindowAppearance: () => Promise<WindowAppearance>
  setWindowAppearance: (theme: 'light' | 'dark' | 'system') => Promise<boolean>
  onAppCommand: (callback: (command: AppCommand) => void) => () => void
  // Settings
  getSetting: <T>(key: string) => Promise<T | null>
  setSetting: (key: string, value: unknown) => Promise<boolean>
  getSettings: () => Promise<Record<string, unknown>>
  updateSettings: (settings: unknown) => Promise<boolean>

  // Vocabulary books
  getVocabularyBooks: (category?: string) => Promise<unknown[]>
  getVocabularyBookById: (id: string) => Promise<unknown>
  createVocabularyBook: (data: unknown) => Promise<unknown>
  updateVocabularyBook: (id: string, data: { name?: string; category?: string; chapterLength?: number }) => Promise<unknown>
  deleteVocabularyBook: (id: string) => Promise<boolean>
  importVocabularyBook: () => Promise<unknown>
  openVocabularyImportWindow: () => Promise<boolean>
  selectVocabularyBookFile: () => Promise<{ canceled: boolean; filePath?: string }>
  importVocabularyBookWithMeta: (data: { filePath: string; name: string; category: string; bookType: 'word' | 'sentence' }) => Promise<unknown>

  // Words
  getWords: (vocabularyBookId: string, limit?: number, offset?: number) => Promise<unknown[]>
  getWordsByBook: (vocabularyBookId: string, chapter?: number, chapterLength?: number) => Promise<unknown[]>

  // Word progress
  updateWordProgress: (wordId: string, correct: boolean) => Promise<unknown>
  setWordFamiliar: (wordId: string, familiar: boolean) => Promise<unknown>
  setWordFamiliarBatch: (wordIds: string[], familiar: boolean) => Promise<boolean>
  getWordProgress: (vocabularyBookId: string) => Promise<unknown[]>
  getChapterProgress: (vocabularyBookId: string, chapterLength: number) => Promise<unknown[]>
  resetWordProgress: (vocabularyBookId: string, wordIds?: string[]) => Promise<boolean>

  // Practice records
  createPracticeRecord: (data: unknown) => Promise<unknown>
  getPracticeRecords: (vocabularyBookId?: string, limit?: number) => Promise<unknown[]>

  // Audios
  getAudios: (limit?: number, offset?: number) => Promise<unknown[]>
  getAudioById: (id: string) => Promise<unknown>
  selectAudioFile: () => Promise<SelectedAudioFile | null>
  importAudio: (token: string, details: AudioResourceDetails) => Promise<string>
  updateAudioDetails: (id: string, details: AudioResourceDetails) => Promise<void>
  openAudioStorageFolder: () => Promise<string>
  getAudioStoragePaths: () => Promise<{ models: string; audios: string }>
  chooseAudioStorageDirectory: (kind: 'models' | 'audios') => Promise<string | null>
  deleteAudio: (id: string) => Promise<boolean>

  // Transcriptions
  getTranscription: (audioId: string) => Promise<unknown>
  getAudioCategories: () => Promise<{id:string;name:string}[]>
  createAudioCategory: (name:string) => Promise<{id:string;name:string}>
  renameAudioCategory: (id:string,name:string) => Promise<{id:string;name:string}>
  deleteAudioCategory: (id:string) => Promise<void>
  updateAudioCategory: (ids: string[], category: string) => Promise<number>
  alignSubtitleText: (audioId: string, text: string) => Promise<unknown>
  writeClipboardText: (text: string) => Promise<void>
  generateSentenceIpa: (audioId: string, segmentId: string) => Promise<string>
  transcribeAudio: (audioId: string, modelId?: string) => Promise<unknown>
  createTranscription: (data: unknown) => Promise<unknown>
  updateTranscription: (id: string, data: unknown) => Promise<unknown>

  // STT Models
  getDownloadedModels: () => Promise<Array<{
    id: string
    name: string
    size: string
    sizeBytes: number
    description: string
    downloaded: boolean
  }>>
  getSttModelsPath: () => Promise<string>
  downloadSttModel: (modelId: string) => Promise<boolean>
  deleteSttModel: (modelId: string) => Promise<boolean>

  // Shell
  openFolder: (folderPath: string) => Promise<string>
  saveTextFile: (data: {
    content: string
    suggestedName: string
    filters?: Electron.FileFilter[]
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>
  saveTextFileToDownloads: (data: {
    content: string
    suggestedName: string
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>

  // Subtitle
  importSubtitle: (audioId: string, duration?: number) => Promise<{ segments?: unknown[]; error?: string } | null>

  // Auth
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<unknown>

  // Window
  setZoomFactor: (zoomFactor: number) => Promise<boolean>

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
