import { create } from 'zustand'
import { normalizeWordRepeat } from '@renderer/lib/vocabulary-repeat'
import { normalizeTheme, type Theme } from '@renderer/lib/theme'
import { DEFAULT_GENERATION_OPTIONS, isGenerationQuality, isGenerationVoice } from '../../shared/audio-generation'
import type { GenerationOptions } from '../../shared/audio-generation'

export interface VocabularySettings {
  phonetic: 'us' | 'uk' | 'close'
  spellingMode: 'fill' | 'dictation'
  wordPosition: 'top' | 'bottom'
  chapterLength: number
  wordExerciseTime: number
  highlightWrongDelay: number
  voiceType: 'us' | 'uk' | 'close'
  randomOrder: boolean
  autoShowTranslationOnInput: boolean
  showTranslation: boolean
  wordFontFamily: string
  wordFontSize: number
  phoneticFontSize: number
  definitionFontSize: number
  examplesFontSize: number

  // Legacy colours are retained for compatibility, but no longer affect rendering.
  wordColor?: string
  definitionColor?: string
  examplesColor?: string
  // Visual settings
  correctColor: string
  wrongColor: string
  wordFontWeight: 400 | 500 | 600 | 700
  definitionFontWeight: 400 | 500 | 600
  examplesFontWeight: 400 | 500 | 600
  highlightKeywordsInExamples: boolean

  // Audio settings
  completionSound: boolean

  // Category management
  customCategories: string[]
  categoryOrder: string[]
}

export interface HotkeySettings {
  prevWord: string
  nextWord: string
  showDefinition: string
  skipWord: string
  favoriteWord: string
  showWord: string
}

export interface UserSettings {
  name: string
  avatar: string | null
}

export interface BasicSettings {
  language: 'zh-CN' | 'en'
  theme: Theme
  zoom: number
  fontScale: number
}

export interface AudioSettings {
  sentenceFontFamily: string
  sentenceFontSize: number
  sentenceFontWeight: 400 | 700
  inlineNoteFontSize: number
  sttModelPath: string
  sttModelId: string
  sttModelsDirectory: string
  audioStorageDirectory: string
  autoPlaySound: boolean
  autoPlayOnSentenceChange: boolean
  soundVolume: number
}

type AudioGenerationSettings = Pick<GenerationOptions, 'quality' | 'voice'>

export interface AppSettings {
  user: UserSettings
  basic: BasicSettings
  vocabulary: VocabularySettings
  audio: AudioSettings
  audioGeneration: AudioGenerationSettings
  hotkeys: HotkeySettings
}

export const defaultSettings: AppSettings = {
  user: {
    name: '',
    avatar: null
  },
  basic: {
    language: 'zh-CN',
    theme: 'system',
    fontScale: 100,
    zoom: 100
  },
  vocabulary: {
    phonetic: 'uk',
    chapterLength: 100,
    wordExerciseTime: 3,
    highlightWrongDelay: 600,
    voiceType: 'uk',
    spellingMode: 'fill',
    wordPosition: 'top',
    randomOrder: false,
    autoShowTranslationOnInput: false,
    showTranslation: true,
    wordFontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    wordFontSize: 36,
    phoneticFontSize: 18,
    definitionFontSize: 16,
    examplesFontSize: 16,
    correctColor: '#2f9e44',
    wrongColor: '#e53935',
    wordFontWeight: 400,
    definitionFontWeight: 400,
    examplesFontWeight: 400,
    highlightKeywordsInExamples: false,
    completionSound: true,
    customCategories: [],
    categoryOrder: []
  },
  audio: {
    sentenceFontFamily: 'Arial, sans-serif',
    sentenceFontSize: 26,
    sentenceFontWeight: 400,
    inlineNoteFontSize: 13,
    sttModelPath: '',
    sttModelId: 'tiny',
    sttModelsDirectory: '',
    audioStorageDirectory: '',
    autoPlaySound: true,
    autoPlayOnSentenceChange: false,
    soundVolume: 80
  },
  audioGeneration: {
    quality: DEFAULT_GENERATION_OPTIONS.quality,
    voice: DEFAULT_GENERATION_OPTIONS.voice
  },
  hotkeys: {
    prevWord: 'meta+[',
    nextWord: 'meta+]',
    showDefinition: 'Tab',
    skipWord: 'Escape',
    favoriteWord: 'meta+k',
    showWord: 'ctrl+w'
  }
}

interface SettingsStore {
  settings: AppSettings
  isOpen: boolean
  activeCategory: string
  isLoading: boolean
  isSaving: boolean

  // Actions
  setOpen: (open: boolean) => void
  setActiveCategory: (category: string) => void
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>
  updateBasicSettings: (updates: Partial<BasicSettings>) => Promise<void>
  updateVocabularySettings: (updates: Partial<VocabularySettings>) => Promise<void>
  updateAudioSettings: (updates: Partial<AudioSettings>) => Promise<void>
  updateAudioGenerationSettings: (updates: Partial<AudioGenerationSettings>) => Promise<void>
  updateHotkeySettings: (updates: Partial<HotkeySettings>) => Promise<void>
}

let audioGenerationSettingsSave = Promise.resolve()

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isOpen: false,
  activeCategory: 'basic',
  isLoading: true,
  isSaving: false,

  setOpen: (open) => set({ isOpen: open }),

  setActiveCategory: (category) => set({ activeCategory: category }),

  loadSettings: async () => {
    set({ isLoading: true })
    const previousGeneration = get().settings.audioGeneration
    const savingGeneration = get().isSaving
    try {
      const result = await window.electronAPI.getSettings() as any
      if (result) {
        const normalizeNumber = (value: unknown, fallback: number) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          if (typeof value === 'string') {
            const parsed = parseInt(value, 10)
            return Number.isFinite(parsed) ? parsed : fallback
          }
          return fallback
        }

        const quality: unknown = result.audioGeneration?.quality
        const voice: unknown = result.audioGeneration?.voice
        const currentGeneration = get().settings.audioGeneration
        const audioGeneration = savingGeneration || currentGeneration !== previousGeneration ? currentGeneration : {
          quality: isGenerationQuality(quality) ? quality : defaultSettings.audioGeneration.quality,
          voice: isGenerationVoice(voice) ? voice : defaultSettings.audioGeneration.voice
        }

        // Merge with defaults to ensure all fields exist
        const merged: AppSettings = {
          user: { ...defaultSettings.user, ...(result.user || {}) },
          basic: { ...defaultSettings.basic, ...(result.basic || {}) },
          vocabulary: { ...defaultSettings.vocabulary, ...(result.vocabulary || {}) },
          audio: { ...defaultSettings.audio, ...(result.audio || {}) },
          audioGeneration,
          hotkeys: { ...defaultSettings.hotkeys, ...(result.hotkeys || {}) }
        }

        // Migration: Update showWord from alt+w to ctrl+w if it matches the old default
        if (merged.hotkeys.showWord === 'alt+w') {
          merged.hotkeys.showWord = 'ctrl+w'
        }
        // Migration: Update favoriteWord from ctrl+d to meta+k if it matches the old default
        if (merged.hotkeys.favoriteWord === 'ctrl+d') {
          merged.hotkeys.favoriteWord = 'meta+k'
        }

        // Also merge legacy flat settings
        if (result.theme && !result.basic?.theme) merged.basic.theme = result.theme
        merged.basic.theme = normalizeTheme(merged.basic.theme, defaultSettings.basic.theme)
        if (result.language) merged.basic.language = result.language
        if (result.chapterLength) merged.vocabulary.chapterLength = result.chapterLength
        if (result.autoPlaySound !== undefined) merged.audio.autoPlaySound = result.autoPlaySound
        if (result.soundVolume !== undefined) merged.audio.soundVolume = result.soundVolume

        merged.basic.fontScale = Math.max(90, Math.min(150, normalizeNumber(merged.basic.fontScale, defaultSettings.basic.fontScale)))
        merged.basic.zoom = normalizeNumber(merged.basic.zoom, defaultSettings.basic.zoom)
        merged.vocabulary.wordExerciseTime = normalizeWordRepeat(merged.vocabulary.wordExerciseTime)
        merged.vocabulary.chapterLength = normalizeNumber(
          merged.vocabulary.chapterLength,
          defaultSettings.vocabulary.chapterLength
        )
        merged.vocabulary.wordFontSize = normalizeNumber(
          merged.vocabulary.wordFontSize,
          defaultSettings.vocabulary.wordFontSize
        )
        merged.vocabulary.phoneticFontSize = normalizeNumber(
          merged.vocabulary.phoneticFontSize,
          defaultSettings.vocabulary.phoneticFontSize
        )
        merged.vocabulary.definitionFontSize = normalizeNumber(
          merged.vocabulary.definitionFontSize,
          defaultSettings.vocabulary.definitionFontSize
        )
        merged.vocabulary.examplesFontSize = normalizeNumber(
          merged.vocabulary.examplesFontSize,
          defaultSettings.vocabulary.examplesFontSize
        )

        // Migration for font weight
        const vocabRes = result.vocabulary || {}
        if (vocabRes.wordFontWeight === undefined && vocabRes.wordFontBold !== undefined) {
           merged.vocabulary.wordFontWeight = vocabRes.wordFontBold ? 600 : 400
        }
        if (vocabRes.definitionFontWeight === undefined && vocabRes.definitionFontBold !== undefined) {
           merged.vocabulary.definitionFontWeight = vocabRes.definitionFontBold ? 600 : 400
        }
        if (vocabRes.examplesFontWeight === undefined && vocabRes.examplesFontBold !== undefined) {
           merged.vocabulary.examplesFontWeight = vocabRes.examplesFontBold ? 600 : 400
        }
        const wordWeight = normalizeNumber(merged.vocabulary.wordFontWeight, defaultSettings.vocabulary.wordFontWeight)
        merged.vocabulary.wordFontWeight = wordWeight === 400 || wordWeight === 500 || wordWeight === 600 || wordWeight === 700
          ? wordWeight
          : defaultSettings.vocabulary.wordFontWeight

        // Ensure boolean flags are set
        if (result.vocabulary?.completionSound === undefined) {
          merged.vocabulary.completionSound = defaultSettings.vocabulary.completionSound
        }

        // Ensure arrays exist
        if (!Array.isArray(merged.vocabulary.customCategories)) {
          merged.vocabulary.customCategories = []
        }
        merged.vocabulary.categoryOrder = Array.isArray(merged.vocabulary.categoryOrder)
          ? merged.vocabulary.categoryOrder.filter((category): category is string => typeof category === 'string')
          : []

        set({ settings: merged })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (updates) => {
    const currentSettings = get().settings
    const newSettings = { ...currentSettings, ...updates }
    set({ settings: newSettings, isSaving: true })

    try {
      await window.electronAPI.updateSettings(updates)
    } catch (error) {
      console.error('Failed to save settings:', error)
      // Revert on error
      set({ settings: currentSettings })
    } finally {
      set({ isSaving: false })
    }
  },

  updateUserSettings: async (updates) => {
    const { settings } = get()
    const newUser = { ...settings.user, ...updates }
    await get().updateSettings({ user: newUser })
  },

  updateBasicSettings: async (updates) => {
    const { settings } = get()
    const newBasic = { ...settings.basic, ...updates }
    await get().updateSettings({ basic: newBasic })
  },

  updateVocabularySettings: async (updates) => {
    const { settings } = get()
    const newVocabulary = { ...settings.vocabulary, ...updates }
    newVocabulary.wordExerciseTime = normalizeWordRepeat(newVocabulary.wordExerciseTime)
    if (newVocabulary.autoShowTranslationOnInput && newVocabulary.showTranslation) {
      if (updates.showTranslation) {
        newVocabulary.autoShowTranslationOnInput = false
      } else {
        newVocabulary.showTranslation = false
      }
    }
    await get().updateSettings({ vocabulary: newVocabulary })
  },

  updateAudioSettings: async (updates) => {
    const { settings } = get()
    const newAudio = { ...settings.audio, ...updates }
    await get().updateSettings({ audio: newAudio })
  },

  updateAudioGenerationSettings: (updates) => {
    audioGenerationSettingsSave = audioGenerationSettingsSave.then(() => {
      const { settings } = get()
      return get().updateSettings({ audioGeneration: { ...settings.audioGeneration, ...updates } })
    })
    return audioGenerationSettingsSave
  },

  updateHotkeySettings: async (updates) => {
    const { settings } = get()
    const newHotkeys = { ...settings.hotkeys, ...updates }
    await get().updateSettings({ hotkeys: newHotkeys })
  }
}))
