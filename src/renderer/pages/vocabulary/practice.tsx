import {Fragment, useEffect, useState, useCallback, useMemo, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent} from 'react'
import {useParams, useNavigate, useSearchParams} from 'react-router-dom'
import {useTranslation} from 'react-i18next'
import {
    ArrowLeft,
    Volume2,
    Clock,
    Keyboard,
    List,
    RotateCcw,
    Star
} from 'lucide-react'
import {cn, compareWord} from '@renderer/lib/utils'
import {sound} from '@renderer/lib/sound'
import {playYoudaoVoice} from '@renderer/lib/voice'
import {useSettingsStore, defaultSettings} from '@renderer/stores/settings-store'
import {normalizeWordRepeat} from '@renderer/lib/vocabulary-repeat'
import {CompletionScreen} from './components/completion-screen'

const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
interface Word {
    id: string
    word: string
    phonetic?: string | null
    phoneticUs?: string | null
    phoneticUk?: string | null
    definition: string
    translation: string | null
    examples?: string[] | null
}

interface VocabularyBook {
    id: string
    bookType?: 'word' | 'sentence'
    chapterLength?: number
    wordCount?: number
}

interface PracticeStats {
    total: number
    completed: number
    correct: number
    wrong: number
    startTime: number
}

interface WordExerciseState {
    correctCount: number // Number of times typed correctly
}

export function VocabularyPracticePage() {
    const {t} = useTranslation()
    const {bookId} = useParams<{ bookId: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const {settings, isOpen: isSettingsOpen} = useSettingsStore()
    const {vocabulary: vocabSettings, hotkeys, audio} = settings
    const defaultShowTranslation =
        vocabSettings.showTranslation && !vocabSettings.autoShowTranslationOnInput

    const chapter = parseInt(searchParams.get('chapter') || '1')
    const [bookChapterLength, setBookChapterLength] = useState(100)
    const chapterLength = useMemo(() => {
        const rawLength = searchParams.get('length')
        const parsed = rawLength ? Number(rawLength) : NaN
        if (Number.isFinite(parsed) && parsed > 0) return parsed
        return bookChapterLength
    }, [searchParams, bookChapterLength])

    const [words, setWords] = useState<Word[]>([])
    const [bookType, setBookType] = useState<'word' | 'sentence'>('word')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [input, setInput] = useState('')
    const [inputState, setInputState] = useState<'typing' | 'correct' | 'wrong'>('typing')
    const [wrongIndex, setWrongIndex] = useState(-1)
    const [wrongSpaceIndex, setWrongSpaceIndex] = useState(-1)
    const [showTranslation, setShowTranslation] = useState(() => defaultShowTranslation)
    const [hasStartedTyping, setHasStartedTyping] = useState(false)
    const [chapterInput, setChapterInput] = useState('')
    const [now, setNow] = useState(Date.now())
    const [stats, setStats] = useState<PracticeStats>({
        total: 0,
        completed: 0,
        correct: 0,
        wrong: 0,
        startTime: Date.now()
    })
    const [isComplete, setIsComplete] = useState(false)
    const [loading, setLoading] = useState(true)
    const [bookWordCount, setBookWordCount] = useState<number | null>(null)
    const [bookName, setBookName] = useState<string>('')
    const [loadedChapter, setLoadedChapter] = useState<number | null>(null)
    const [showWordList, setShowWordList] = useState(false)
    const [showWord, setShowWord] = useState(true)
    const [excludeFamiliar, setExcludeFamiliar] = useState(false)
    const [filteredWordCount, setFilteredWordCount] = useState<number | null>(null)
    const [familiarWordIds, setFamiliarWordIds] = useState<Set<string>>(new Set())
    const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isProcessingRef = useRef(false)

    // Book specific settings
    const effectiveExerciseTime = useMemo(() => {
        if (!bookId) return normalizeWordRepeat(vocabSettings.wordExerciseTime)
        try {
            const stored = localStorage.getItem(`book_settings_${bookId}`)
            const parsed = stored ? JSON.parse(stored) : null
            if (parsed && typeof parsed.wordExerciseTime === 'number') {
                return normalizeWordRepeat(parsed.wordExerciseTime)
            }
        } catch {}
        return normalizeWordRepeat(vocabSettings.wordExerciseTime)
    }, [bookId, vocabSettings.wordExerciseTime])

    // Track exercise state for each word (correctCount for wordExerciseTime)
    const [wordExerciseStates, setWordExerciseStates] = useState<Map<string, WordExerciseState>>(new Map())

    const currentWord = words[currentIndex]
    const currentWordId = currentWord?.id
    const isLastWord = currentIndex >= words.length - 1
    const isFirstWord = currentIndex <= 0
    const isSentenceMode = bookType === 'sentence'
    const currentExerciseState = currentWord ? wordExerciseStates.get(currentWord.id) : undefined
    const currentCorrectCount = currentExerciseState?.correctCount || 0
    const correctColor = 'var(--practice-correct)'
    const shouldShowWord = showWord
    const isFamiliar = currentWordId ? familiarWordIds.has(currentWordId) : false
    const progressKey = useMemo(() => {
        if (!bookId) return null
        return `practice_progress_${bookId}_${chapter}${excludeFamiliar ? '_nofamiliar' : ''}`
    }, [bookId, chapter, excludeFamiliar])
    const completionKey = useMemo(() => {
        if (!bookId) return null
        return `practice_completed_${bookId}_${chapter}${excludeFamiliar ? '_nofamiliar' : ''}`
    }, [bookId, chapter, excludeFamiliar])
    const getProgressKey = useCallback((targetChapter: number) => {
        if (!bookId) return null
        return `practice_progress_${bookId}_${targetChapter}${excludeFamiliar ? '_nofamiliar' : ''}`
    }, [bookId, excludeFamiliar])
    const effectiveWordCount = useMemo(() => {
        if (excludeFamiliar && filteredWordCount !== null) return filteredWordCount
        return bookWordCount
    }, [excludeFamiliar, filteredWordCount, bookWordCount])

    const normalizedSentence = useMemo(() => {
        if (!currentWord) return ''
        return currentWord.word.trim().replace(/\s+/g, ' ')
    }, [currentWord])

    const sentenceTokens = useMemo(() => {
        if (!normalizedSentence) return []
        return normalizedSentence.split(' ')
    }, [normalizedSentence])

    const totalChapters = useMemo(() => {
        if (effectiveWordCount === null) return null
        if (effectiveWordCount === 0) return 0
        return Math.max(1, Math.ceil(effectiveWordCount / chapterLength))
    }, [effectiveWordCount, chapterLength])

    const isEditableTarget = useCallback((target: EventTarget | null) => {
        if (!target) return false
        const element = target as HTMLElement
        const tag = element.tagName?.toLowerCase()
        return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
    }, [])

    // Safety check for index out of bounds
    useEffect(() => {
        if (!loading && words.length > 0 && currentIndex >= words.length) {
            console.warn('Current index out of bounds, resetting to 0')
            setCurrentIndex(0)
        }
    }, [currentIndex, words.length, loading])

    useEffect(() => {
        if (!currentWordId) return
        setShowTranslation(defaultShowTranslation)
        setHasStartedTyping(false)
        setWrongIndex(-1)
        setWrongSpaceIndex(-1)
    }, [currentWordId, defaultShowTranslation])

    useEffect(() => {
        setChapterInput('')
    }, [chapter])

    useEffect(() => {
        if (!bookId) return
        const stored = localStorage.getItem(`vocab_filter_familiar_${bookId}`)
        setExcludeFamiliar(stored === 'true')
    }, [bookId])

    // Save progress
    useEffect(() => {
        if (progressKey && currentIndex > 0 && words.length > 0 && loadedChapter === chapter) {
            const state = {
                index: currentIndex,
                order: words.map(w => w.id)
            }
            localStorage.setItem(progressKey, JSON.stringify(state))
        }
    }, [progressKey, chapter, currentIndex, words, loadedChapter])

    // Shuffle array helper
    const shuffleArray = <T, >(array: T[]): T[] => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    const loadWordProgress = useCallback(async () => {
        if (!bookId) return new Set<string>()
        try {
            const rawProgress = await window.electronAPI.getWordProgress(bookId) as any[]

            // Normalize data to handle both plain objects and Sequelize instances (serialized)
            const progress = rawProgress.map(item => item.dataValues || item)

            const dbFamiliarIds = new Set(
                progress.filter((item) => !!item.familiar).map((item) => item.wordId)
            )
            setFamiliarWordIds(dbFamiliarIds)
            return dbFamiliarIds
        } catch (error) {
            console.error('Failed to load word progress:', error)
            // Return empty set but do NOT clear state to avoid flashing/resetting on transient errors
            return new Set<string>()
        }
    }, [bookId])

    useEffect(() => {
        if (!bookId) return
        loadWordProgress()
        const unsubscribe = window.electronAPI.on('word-progress-updated', () => {
            loadWordProgress()
        })
        return () => {
            unsubscribe()
        }
    }, [bookId, loadWordProgress])

    // Load book type
    useEffect(() => {
        if (!bookId) return

        const loadBook = async () => {
            try {
                const result = await window.electronAPI.getVocabularyBookById(bookId)
                const book = result as VocabularyBook | null
                setBookType(book?.bookType === 'sentence' ? 'sentence' : 'word')
                setBookChapterLength(
                    Number.isFinite(Number(book?.chapterLength)) ? Number(book?.chapterLength) : 100
                )
                setBookWordCount(
                    Number.isFinite(Number(book?.wordCount)) ? Number(book?.wordCount) : null
                )
                if (book && 'name' in book) {
                    setBookName((book as any).name || '')
                }
            } catch (error) {
                console.error('Failed to load book:', error)
            }
        }

        loadBook()
    }, [bookId])

    // Load words for the chapter
    useEffect(() => {
        if (!bookId) return

        const loadWords = async () => {
            setLoading(true)
            setIsComplete(false)
            setWords([])
            setCurrentIndex(0)
            try {
                const normalizeWords = (rawWords: any[]): Word[] => rawWords.map((w) => {
                    let parsedExamples: string[] | null = null
                    if (w.examples) {
                        try {
                            parsedExamples = JSON.parse(w.examples)
                        } catch {
                            parsedExamples = [w.examples]
                        }
                    }
                    return {
                        ...w,
                        examples: parsedExamples,
                        word: w.word
                            .replace(/[()]/g, '')
                            .replace(/\[[^\]]*\]/g, '')
                            .trim()
                            .replace(/\s+/g, ' ')
                    } as Word
                }).filter(
                    (word) =>
                        (word.definition && word.definition.trim()) ||
                        (word.translation && word.translation.trim())
                )

                const familiarIds = await loadWordProgress()
                let wordsToSet: Word[] = []
                if (excludeFamiliar) {
                    const allResult = await window.electronAPI.getWordsByBook(bookId)
                    const normalized = normalizeWords(allResult as any[])
                    const filteredWords = normalized.filter((word) => !familiarIds.has(word.id))
                    setFilteredWordCount(filteredWords.length)
                    const offset = (chapter - 1) * chapterLength
                    wordsToSet = filteredWords.slice(offset, offset + chapterLength)
                } else {
                    setFilteredWordCount(null)
                    const offset = (chapter - 1) * chapterLength
                    const result = await window.electronAPI.getWords(bookId, chapterLength, offset)
                    wordsToSet = normalizeWords(result as any[])
                }

                // Restore progress
                const savedStateStr = progressKey ? localStorage.getItem(progressKey) : null
                let initialIndex = 0

                if (savedStateStr) {
                    try {
                        // Try parsing as JSON (new format)
                        const state = JSON.parse(savedStateStr)
                        if (state && typeof state.index === 'number' && Array.isArray(state.order)) {
                            // Reorder wordsToSet based on saved order
                            const wordMap = new Map(wordsToSet.map(w => [w.id, w]))
                            const orderedWords: Word[] = []

                            // First add words from saved order if they exist
                            state.order.forEach((id: string) => {
                                const w = wordMap.get(id)
                                if (w) {
                                    orderedWords.push(w)
                                    wordMap.delete(id)
                                }
                            })

                            // Add remaining words (if any new ones or mismatches)
                            wordMap.forEach(w => orderedWords.push(w))

                            if (orderedWords.length === wordsToSet.length) {
                                wordsToSet = orderedWords
                                if (state.index >= 0 && state.index < wordsToSet.length) {
                                    initialIndex = state.index
                                }
                            }
                        } else {
                            // Legacy format (just number) or invalid JSON
                            const idx = parseInt(savedStateStr, 10)
                            if (!isNaN(idx) && idx >= 0 && idx < wordsToSet.length) {
                                initialIndex = idx
                            }
                            // If legacy and randomOrder is on, we unfortunately have a shuffled list that might not match.
                            // But we can't do much about legacy data.
                        }
                    } catch (e) {
                        // Fallback for simple string (legacy)
                        const idx = parseInt(savedStateStr, 10)
                        if (!isNaN(idx) && idx >= 0 && idx < wordsToSet.length) {
                            initialIndex = idx
                        }
                    }
                } else {
                    // No saved state, apply random order if enabled
                    if (vocabSettings.randomOrder) {
                        wordsToSet = shuffleArray(wordsToSet)
                    }
                }

                setWords(wordsToSet)

                // Reset all practice states for new chapter
                setInput('')
                setInputState('typing')
                setWrongIndex(-1)
                setWrongSpaceIndex(-1)
                setHasStartedTyping(false)

                setCurrentIndex(initialIndex)
                setIsComplete(false)
                setStats({
                    total: wordsToSet.length,
                    completed: initialIndex,
                    correct: 0,
                    wrong: 0,
                    startTime: Date.now()
                })

                // Initialize exercise states
                const initialStates = new Map<string, WordExerciseState>()
                wordsToSet.forEach(word => {
                    initialStates.set(word.id, {correctCount: 0})
                })
                setWordExerciseStates(initialStates)

                // Mark chapter as loaded to enable saving
                setLoadedChapter(chapter)
            } catch (error) {
                console.error('Failed to load words:', error)
            } finally {
                setLoading(false)
            }
        }

        loadWords()
    }, [bookId, chapter, chapterLength, vocabSettings.randomOrder, excludeFamiliar, loadWordProgress, progressKey])

    // Play pronunciation based on voiceType setting
    const playSound = useCallback(() => {
        if (!currentWord || vocabSettings.voiceType === 'close') return

        playYoudaoVoice(currentWord.word, vocabSettings.voiceType, audio.soundVolume / 100)
    }, [currentWord, vocabSettings.voiceType, audio.soundVolume])

    // Auto play pronunciation when word changes
    useEffect(() => {
        if (!currentWord || loading || isComplete) return
        if (!audio.autoPlaySound || vocabSettings.voiceType === 'close') return
        playSound()
    }, [currentWord, loading, isComplete, audio.autoPlaySound, vocabSettings.voiceType, playSound])

    // Toggle translation visibility
    const toggleTranslation = useCallback(() => {
        setShowTranslation(prev => !prev)
    }, [])

    const toggleFamiliarForWord = useCallback(async (wordId: string) => {
        const nextValue = !familiarWordIds.has(wordId)
        // Optimistic update
        const nextSet = new Set(familiarWordIds)
        if (nextValue) {
            nextSet.add(wordId)
        } else {
            nextSet.delete(wordId)
        }
        setFamiliarWordIds(nextSet)

        try {
            await window.electronAPI.setWordFamiliar(wordId, nextValue)
        } catch (error) {
            console.error('Failed to update familiar status:', error)
            // Revert on error
            loadWordProgress()
        }
    }, [familiarWordIds, loadWordProgress])

    const toggleFamiliar = useCallback(() => {
        if (!currentWordId) return
        toggleFamiliarForWord(currentWordId)
    }, [currentWordId, toggleFamiliarForWord])

    const jumpToChapter = useCallback(() => {
        if (!bookId) return
        const nextChapter = parseInt(chapterInput, 10)
        if (!Number.isFinite(nextChapter)) return

        let targetChapter = Math.max(1, nextChapter)
        if (totalChapters) {
            targetChapter = Math.min(targetChapter, totalChapters)
        }

        if (targetChapter === chapter) {
            setChapterInput('')
            return
        }

        const targetKey = getProgressKey(targetChapter)
        if (targetKey) {
            localStorage.removeItem(targetKey)
        }
        navigate(`/vocabulary/${bookId}/practice?chapter=${targetChapter}&length=${chapterLength}`, {replace: true})
        setChapterInput('')
    }, [bookId, chapterInput, totalChapters, chapter, navigate, chapterLength, getProgressKey])

    // Go to previous word
    const goToPrevWord = useCallback(() => {
        if (currentIndex > 0) {
            const prevWord = words[currentIndex - 1]
            if (prevWord) {
                 setWordExerciseStates(prev => {
                    const next = new Map(prev)
                    next.set(prevWord.id, { correctCount: 0 })
                    return next
                })
            }
            setCurrentIndex(prev => prev - 1)
            setInput('')
            setInputState('typing')
            setWrongIndex(-1)
            setWrongSpaceIndex(-1)
            setHasStartedTyping(false)
        }
    }, [currentIndex, words])

    // Go to next word
    const goToNextWord = useCallback(() => {
        if (currentIndex < words.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setInput('')
            setInputState('typing')
            setWrongIndex(-1)
            setWrongSpaceIndex(-1)
            setHasStartedTyping(false)
        }
    }, [currentIndex, words.length])

    // Restart practice
    const restart = useCallback(() => {
        if (progressKey) {
            localStorage.removeItem(progressKey)
        }
        setCurrentIndex(0)
        setInput('')
        setInputState('typing')
        setWrongIndex(-1)
        setWrongSpaceIndex(-1)
        setHasStartedTyping(false)
        setIsComplete(false)
        setStats({
            total: words.length,
            completed: 0,
            correct: 0,
            wrong: 0,
            startTime: Date.now()
        })
        // Reset exercise states
        const resetStates = new Map<string, WordExerciseState>()
        words.forEach(word => {
            resetStates.set(word.id, {correctCount: 0})
        })
        setWordExerciseStates(resetStates)
    }, [words, progressKey])

    const completeCurrentEntry = useCallback(
        (finalInput: string) => {
            if (!currentWord || isProcessingRef.current) return

            if (vocabSettings.completionSound) {
                sound.correct()
            }

            const newCorrectCount = currentCorrectCount + 1

            setWordExerciseStates(prev => {
                const newStates = new Map(prev)
                newStates.set(currentWord.id, {
                    correctCount: newCorrectCount
                })
                return newStates
            })

            if (newCorrectCount >= effectiveExerciseTime) {
                setInput(finalInput)
                setInputState('correct')
                setStats((prev) => ({
                    ...prev,
                    completed: prev.completed + 1,
                    correct: prev.correct + (wrongIndex === -1 ? 1 : 0),
                    wrong: prev.wrong + (wrongIndex === -1 ? 0 : 1)
                }))

                const wasCorrect = wrongIndex === -1
                // Record the completion so chapter progress is marked as finished.
                if (!wasCorrect) {
                    window.electronAPI.updateWordProgress(currentWord.id, false)
                }
                window.electronAPI.updateWordProgress(currentWord.id, true)
                isProcessingRef.current = true

                setTimeout(() => {
                    isProcessingRef.current = false
                    if (currentIndex < words.length - 1) {
                        setCurrentIndex((prev) => prev + 1)
                        setInput('')
                        setInputState('typing')
                        setWrongIndex(-1)
                        setWrongSpaceIndex(-1)
                        setHasStartedTyping(false)
                    } else {
                        if (completionKey) {
                            localStorage.setItem(completionKey, String(Date.now()))
                        }
                        setIsComplete(true)
                        sound.complete()
                    }
                }, 400)
            } else {
                setInput(finalInput)
                setInputState('correct')
                setTimeout(() => {
                    setInput('')
                    setInputState('typing')
                    setWrongIndex(-1)
                    setWrongSpaceIndex(-1)
                    // Play sound again for next repetition if enabled
                    if (audio.autoPlaySound && vocabSettings.voiceType !== 'close') {
                        playSound()
                    }
                }, 300)
            }
        },
        [
            currentWord,
            currentCorrectCount,
            vocabSettings, // Add entire vocabSettings object to dependency array
            wrongIndex,
            currentIndex,
            words.length,
            audio.autoPlaySound,
            playSound,
            effectiveExerciseTime,
            completionKey
        ]
    )

    // Parse hotkey string to check against keyboard event
    const matchesHotkey = useCallback((e: KeyboardEvent, hotkeyStr: string): boolean => {
        const parts = hotkeyStr.toLowerCase().split('+')
        const key = parts[parts.length - 1]
        const needsCtrl = parts.includes('ctrl')
        const needsAlt = parts.includes('alt')
        const needsShift = parts.includes('shift')
        const needsMeta = parts.includes('meta')

        const pressedKey = e.key.toLowerCase()
        const ctrlMatch = needsCtrl ? e.ctrlKey : !e.ctrlKey
        const altMatch = needsAlt ? e.altKey : !e.altKey
        const shiftMatch = needsShift ? e.shiftKey : !e.shiftKey
        const metaMatch = needsMeta ? e.metaKey : !e.metaKey

        return pressedKey === key && ctrlMatch && altMatch && shiftMatch && metaMatch
    }, [])

    const shouldHandleHotkey = useCallback((hotkeyStr: string) => {
        const parts = hotkeyStr.toLowerCase().split('+')
        const key = parts[parts.length - 1]
        const hasModifier = parts.some((part) => ['ctrl', 'alt', 'shift', 'meta'].includes(part))
        return hasModifier || key.length > 1
    }, [])

    const isFamiliarHotkey = useCallback((e: KeyboardEvent) => {
        if (!shouldHandleHotkey(hotkeys.favoriteWord)) return false
        return matchesHotkey(e, hotkeys.favoriteWord)
    }, [hotkeys.favoriteWord, matchesHotkey, shouldHandleHotkey])

    // Hotkey handler
    useEffect(() => {
        if (isComplete || loading || isSettingsOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            sound.resume()
            if (isFamiliarHotkey(e)) {
                e.preventDefault()
                e.stopPropagation()
                toggleFamiliar()
                return
            }
            if (isEditableTarget(e.target)) return
            // Check hotkeys
            if (shouldHandleHotkey(hotkeys.prevWord) && matchesHotkey(e, hotkeys.prevWord)) {
                e.preventDefault()
                e.stopPropagation()
                goToPrevWord()
            } else if (shouldHandleHotkey(hotkeys.nextWord) && matchesHotkey(e, hotkeys.nextWord)) {
                e.preventDefault()
                e.stopPropagation()
                goToNextWord()
            } else if (shouldHandleHotkey(hotkeys.showDefinition) && matchesHotkey(e, hotkeys.showDefinition)) {
                e.preventDefault()
                e.stopPropagation()
                toggleTranslation()
            } else if (shouldHandleHotkey(hotkeys.showWord) && matchesHotkey(e, hotkeys.showWord)) {
                e.preventDefault()
                e.stopPropagation()
                setShowWord((prev) => !prev)
            }
        }

        window.addEventListener('keydown', handleKeyDown, {capture: true})
        return () => {
            window.removeEventListener('keydown', handleKeyDown, {capture: true})
        }
    }, [
        isComplete,
        loading,
        hotkeys,
        goToPrevWord,
        goToNextWord,
        toggleTranslation,
        matchesHotkey,
        shouldHandleHotkey,
        isSettingsOpen,
        isEditableTarget,
        toggleFamiliar,
        isFamiliarHotkey
    ])

    // Update elapsed time tick
    useEffect(() => {
        if (isComplete || loading) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [isComplete, loading, stats.startTime])

    // Calculate elapsed time
    const getElapsedTime = () => {
        const elapsed = Math.max(0, Math.floor((now - stats.startTime) / 1000))
        const mins = Math.floor(elapsed / 60)
        const secs = elapsed % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatHotkey = useCallback((hotkey: string) => {
        const keyMap: Record<string, string> = {
            arrowleft: '\u2190',
            arrowright: '\u2192',
            arrowup: '\u2191',
            arrowdown: '\u2193',
            escape: 'Esc',
            tab: 'Tab',
            enter: 'Enter',
            space: 'Space',
            backspace: 'Backspace',
            delete: 'Delete',
            ctrl: 'Ctrl',
            alt: isMac ? '⌥' : 'Alt',
            shift: 'Shift',
            meta: isMac ? '⌘' : 'Win'
        }

        return hotkey
            .split('+')
            .map((part) => {
                const normalized = part.trim().toLowerCase()
                return keyMap[normalized] || part.trim().toUpperCase()
            })
            .join(' + ')
    }, [])

    const primaryShortcuts = [
        {
            label: t('settings.hotkeys.prevWord'),
            key: formatHotkey(hotkeys.prevWord),
            onClick: goToPrevWord,
            disabled: isFirstWord
        },
        {
            label: showTranslation ? t('practice.hideHint') : t('practice.showHint'),
            key: formatHotkey(hotkeys.showDefinition),
            onClick: toggleTranslation,
            disabled: false
        },
        {
            label: showWord ? t('practice.hideWord') : t('practice.showWord'),
            key: formatHotkey(hotkeys.showWord),
            onClick: () => setShowWord((prev) => !prev),
            disabled: false
        },
        {
            label: isFamiliar ? t('practice.unmarkWord') : t('practice.markWord'),
            key: formatHotkey(hotkeys.favoriteWord),
            onClick: toggleFamiliar,
            disabled: false
        }
    ]
    const nextShortcut = {
        label: t('settings.hotkeys.nextWord'),
        key: formatHotkey(hotkeys.nextWord),
        onClick: goToNextWord,
        disabled: isLastWord
    }

    // Get phonetic based on settings
    const getPhonetic = () => {
        if (!currentWord || vocabSettings.phonetic === 'close') return null
        if (vocabSettings.phonetic === 'us') {
            return currentWord.phoneticUs || currentWord.phonetic
        }
        return currentWord.phoneticUk || currentWord.phonetic
    }

    // Handle keyboard input directly (no input box)
    useEffect(() => {
        if (isComplete || loading || isSettingsOpen || !currentWord) return

        const normalizeInput = (value: string) => value.trim().replace(/\s+/g, ' ')
        const isSentenceComplete = (value: string) => {
            if (!normalizedSentence) return false
            return normalizeInput(value).toLowerCase() === normalizedSentence.toLowerCase()
        }
        const getSentenceState = (value: string) => {
            const normalized = normalizeInput(value)
            const inputTokens = normalized ? normalized.split(' ') : []
            const hasTrailingSpace = value.endsWith(' ')
            const completedCount = hasTrailingSpace ? inputTokens.length : Math.max(0, inputTokens.length - 1)
            const currentTokenIndex = completedCount
            const currentTokenInput = hasTrailingSpace ? '' : (inputTokens[inputTokens.length - 1] || '')
            return {
                normalized,
                inputTokens,
                hasTrailingSpace,
                completedCount,
                currentTokenIndex,
                currentTokenInput
            }
        }
        const getSpaceErrorIndex = (tokenIndex: number, hasTrailingSpace: boolean) => {
            const candidate = hasTrailingSpace ? tokenIndex - 1 : tokenIndex
            if (candidate < 0 || candidate >= sentenceTokens.length - 1) return -1
            return candidate
        }
        const handleSentenceMistake = (
            nextWrongIndex: number,
            nextWrongSpaceIndex: number,
            resetValue: string
        ) => {
            setInputState('wrong')
            setWrongIndex(nextWrongIndex)
            setWrongSpaceIndex(nextWrongSpaceIndex)
            setInput(resetValue)
            playSound()
            setTimeout(() => {
                setInputState('typing')
                setWrongIndex(-1)
                setWrongSpaceIndex(-1)
            }, vocabSettings.highlightWrongDelay)
        }

        const handleTypingStart = (value: string) => {
            if (!hasStartedTyping && value.length > 0) {
                setHasStartedTyping(true)
                if (vocabSettings.autoShowTranslationOnInput) {
                    setShowTranslation(true)
                }
            }
        }

        const handleSentenceKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return

            const isSpace = e.key === ' ' || e.code === 'Space'
            const sentenceState = getSentenceState(input)
            const {inputTokens, hasTrailingSpace, completedCount, currentTokenIndex, currentTokenInput} =
                sentenceState
            const targetToken = sentenceTokens[currentTokenIndex]

            if (e.key === 'Backspace') {
                e.preventDefault()
                if (input.length > 0) {
                    const nextValue = input.slice(0, -1)
                    setInput(nextValue)
                    setInputState('typing')
                    setWrongIndex(-1)
                    setWrongSpaceIndex(-1)
                }
                return
            }

            if (isSpace || e.key === 'Enter') {
                e.preventDefault()
                if (!targetToken) return

                if (!currentTokenInput || currentTokenInput.toLowerCase() !== targetToken.toLowerCase()) {
                    const previousTokens = inputTokens.slice(0, completedCount).join(' ')
                    const resetValue = previousTokens ? `${previousTokens} ` : ''
                    const spaceErrorIndex = getSpaceErrorIndex(currentTokenIndex, hasTrailingSpace)
                    const nextWrongIndex = currentTokenInput ? currentTokenIndex : -1

                    handleSentenceMistake(nextWrongIndex, spaceErrorIndex, resetValue)
                    return
                }

                const nextValue = `${sentenceState.normalized} `
                setInput(nextValue)
                setInputState('typing')
                setWrongSpaceIndex(-1)
                handleTypingStart(nextValue)

                if (isSentenceComplete(nextValue)) {
                    completeCurrentEntry(normalizedSentence)
                }
                return
            }

            if (e.key.length > 1) return

            e.preventDefault()
            if (!targetToken) return

            const nextTokenInput = `${currentTokenInput}${e.key}`
            if (!targetToken.toLowerCase().startsWith(nextTokenInput.toLowerCase())) {
                const previousTokens = inputTokens.slice(0, completedCount).join(' ')
                const resetValue = previousTokens ? `${previousTokens} ` : ''
                handleSentenceMistake(currentTokenIndex, -1, resetValue)
                return
            }

            // Use original casing from targetToken
            const charToAdd = targetToken[currentTokenInput.length]
            const newValue = input + charToAdd
            handleTypingStart(newValue)

            if (isSentenceComplete(newValue)) {
                completeCurrentEntry(normalizedSentence)
                return
            }

            setInput(newValue)
            setInputState('typing')
            setWrongSpaceIndex(-1)
        }

        const handleWordKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return
            if (e.key.length > 1 && e.key !== 'Backspace') return

            e.preventDefault()

            if (e.key === 'Backspace') {
                if (input.length > 0) {
                    setInput(prev => prev.slice(0, -1))
                    setInputState('typing')
                    setWrongIndex(-1)
                    setWrongSpaceIndex(-1)
                }
                return
            }

            const targetChar = currentWord.word[input.length]
            const typedChar = e.key
            let charToAdd = typedChar
            if (targetChar && targetChar.toLowerCase() === typedChar.toLowerCase()) {
                charToAdd = targetChar
            }

            const newValue = input + charToAdd
            handleTypingStart(newValue)

            const result = compareWord(currentWord.word, newValue)

            if (result === -2) {
                completeCurrentEntry(newValue)
            } else if (result >= 0) {
                setInput(newValue)
                setInputState('wrong')
                setWrongIndex(result)
                playSound()

                setTimeout(() => {
                    setInput('')
                    setInputState('typing')
                    setWrongIndex(-1)
                    setWrongSpaceIndex(-1)
                }, vocabSettings.highlightWrongDelay)
            } else {
                setInput(newValue)
                setInputState('typing')
                setWrongSpaceIndex(-1)
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isFamiliarHotkey(e)) {
                e.preventDefault()
                e.stopPropagation()
                toggleFamiliar()
                return
            }
            if (isEditableTarget(e.target) && vocabSettings.spellingMode !== 'dictation') return
            if (vocabSettings.spellingMode === 'dictation' && isEditableTarget(e.target)) {
                 // In dictation mode, let the input handle typing, but catch global hotkeys
                 if (shouldHandleHotkey(hotkeys.prevWord) && matchesHotkey(e, hotkeys.prevWord)) {
                    e.preventDefault()
                    e.stopPropagation()
                    goToPrevWord()
                    return
                } else if (shouldHandleHotkey(hotkeys.nextWord) && matchesHotkey(e, hotkeys.nextWord)) {
                    e.preventDefault()
                    e.stopPropagation()
                    goToNextWord()
                    return
                } else if (shouldHandleHotkey(hotkeys.showDefinition) && matchesHotkey(e, hotkeys.showDefinition)) {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleTranslation()
                    return
                } else if (shouldHandleHotkey(hotkeys.showWord) && matchesHotkey(e, hotkeys.showWord)) {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowWord((prev) => !prev)
                    return
                }
                return
            }

            if (isEditableTarget(e.target)) return

            if (isSentenceMode) {
                handleSentenceKeyDown(e)
            } else {
                handleWordKeyDown(e)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        isComplete,
        loading,
        currentWord,
        input,
        hasStartedTyping,
        vocabSettings.autoShowTranslationOnInput,
        vocabSettings.highlightWrongDelay,
        vocabSettings.spellingMode, // Added dependency
        normalizedSentence,
        sentenceTokens,
        completeCurrentEntry,
        isSentenceMode,
        isSettingsOpen,
        isEditableTarget,
        hotkeys,
        matchesHotkey,
        shouldHandleHotkey,
        toggleFamiliar,
        isFamiliarHotkey
    ])

    // Dictation Mode Input Handler
    const handleDictationKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const cleanInput = input.trim().replace(/\s+/g, ' ')
            const target = currentWord.word.trim().replace(/\s+/g, ' ')

            if (cleanInput.toLowerCase() === target.toLowerCase()) {
                completeCurrentEntry(cleanInput)
            } else {
                setInputState('wrong')
                setWrongIndex(0) // Just to trigger effect if needed
                sound.wrong()
                playSound()
                setTimeout(() => {
                    setInputState('typing')
                    setWrongIndex(-1)
                }, vocabSettings.highlightWrongDelay)
            }
        }
    }

    // Render word for dictation mode
    const renderDictationWord = () => {
        if (!currentWord) return null
        return (
            <div
                className={cn(
                    "transition-opacity duration-200",
                    shouldShowWord ? "opacity-100" : "opacity-0"
                )}
            >
                 <div
                    className="text-center font-medium"
                    style={{
                        fontSize: `${vocabSettings.wordFontSize}px`,
                        fontFamily: vocabSettings.wordFontFamily,
                        fontWeight: vocabSettings.wordFontWeight,
                        color: 'var(--practice-word)'
                    }}
                 >
                    {currentWord.word}
                 </div>

                 {getPhonetic() && (
                    <div className="flex items-center justify-center gap-3 text-muted-foreground mt-2">
                        <span
                            className="font-medium"
                            style={{fontSize: `${vocabSettings.phoneticFontSize}px`}}
                        >
                          {getPhonetic()}
                        </span>
                        <button
                            onClick={playSound}
                            className="glass-control rounded-full p-2 transition-colors hover:text-primary-ink"
                        >
                            <Volume2 className="h-5 w-5"/>
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // Render word with character highlighting - always show the word
    const renderWord = () => {
        if (!currentWord) return null

        const wrongColor = 'var(--practice-wrong)'
        const wordStyle: CSSProperties = {
            fontSize: `${vocabSettings.wordFontSize}px`,
            fontFamily: vocabSettings.wordFontFamily,
            fontWeight: vocabSettings.wordFontWeight
        }

        if (isSentenceMode) {
            const normalizedInput = input.trim().replace(/\s+/g, ' ')
            const inputTokens = normalizedInput ? normalizedInput.split(' ') : []
            const hasTrailingSpace = input.endsWith(' ')
            const completedCount = hasTrailingSpace ? inputTokens.length : Math.max(0, inputTokens.length - 1)
            const currentTokenIndex = Math.min(completedCount, sentenceTokens.length)
            const currentTokenInput = !hasTrailingSpace ? (inputTokens[inputTokens.length - 1] || '') : ''

            return (
                <div className="flex flex-wrap justify-center gap-1 items-baseline">
                    {sentenceTokens.map((token, index) => {
                        const bgClass = 'bg-transparent'
                        let customStyle: CSSProperties = {...wordStyle, color: 'var(--practice-word)'}

                        if (index === wrongIndex) {
                            customStyle = {...wordStyle, color: wrongColor}
                        } else if (index < completedCount) {
                            customStyle = {...wordStyle, color: correctColor}
                        }

                        const showInputOverlay =
                            index === currentTokenIndex && currentTokenInput && wrongIndex !== index
                        const typedPart = showInputOverlay ? currentTokenInput : ''
                        const remainingPart = showInputOverlay ? token.slice(typedPart.length) : ''

                        const displayToken = shouldShowWord ? token : '_'.repeat(token.length)
                        const displayRemaining = shouldShowWord ? remainingPart : '_'.repeat(remainingPart.length)

                        const tokenContent = showInputOverlay ? (
                            <span className="flex items-center">
                <span style={{color: correctColor}}>{typedPart}</span>
                                {remainingPart ? (
                                    <span>{displayRemaining}</span>
                                ) : null}
              </span>
                        ) : (
                            // If fully typed (correct), always show. If not typed, respect showWord.
                            index < completedCount ? token : displayToken
                        )

                        return (
                            <Fragment key={`${token}-${index}`}>
                <span
                    className={cn(
                        'flex items-center justify-center rounded-md py-1 font-medium sm:rounded-lg',
                        bgClass
                    )}
                    style={customStyle}
                >
                  {tokenContent}
                </span>
                                {index < sentenceTokens.length - 1 && (
                                    <span
                                        className="inline-block w-2.5 text-center border-b-2 transition-colors"
                                        style={{
                                            borderColor:
                                                wrongSpaceIndex === index
                                                    ? wrongColor
                                                    : index < completedCount
                                                        ? correctColor
                                                        : 'transparent'
                                        }}
                                    >
                    {'\u00A0'}
                  </span>
                                )}
                            </Fragment>
                        )
                    })}
                </div>
            )
        }

        return (
            <div className="flex flex-wrap justify-center items-baseline gap-0.5">
                {currentWord.word.split('').map((char, index) => {
                    const isSpace = char === ' '
                    let customStyle: CSSProperties = {...wordStyle, color: 'var(--practice-word)'}
                    let borderColor = 'transparent'

                    if (index < input.length) {
                        if (index === wrongIndex) {
                            // Wrong character
                            customStyle = {...wordStyle, color: wrongColor}
                            if (isSpace) borderColor = wrongColor
                        } else {
                            // Correct character
                            customStyle = {...wordStyle, color: correctColor}
                            if (isSpace) borderColor = correctColor
                        }
                    }

                    if (isSpace) {
                        return (
                            <span
                                key={index}
                                className="inline-block w-2.5 border-b-2 transition-colors text-center"
                                style={{borderColor}}
                            >
                {'\u00A0'}
              </span>
                        )
                    }

                    const isTyped = index < input.length
                    const charContent = isTyped || shouldShowWord ? char : '_'

                    return (
                        <span
                            key={index}
                            className={cn(
                                'inline-flex items-center justify-center font-medium leading-tight',
                                'bg-transparent'
                            )}
                            style={customStyle}
                        >
              {charContent}
            </span>
                    )
                })}
            </div>
        )
    }

    const renderExample = useCallback((text: string) => {
        if (!vocabSettings.highlightKeywordsInExamples || !currentWord) return text

        try {
            // Remove common placeholders and clean up
            const cleanWord = currentWord.word
                .replace(/\([^)]*\)/g, '')
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\b(sb|sth|somebody|something|one's|someone)\b/gi, '')
                .trim()

            if (!cleanWord) return text

            const tokens = cleanWord.split(/\s+/)
            const patternParts = tokens.map(token => {
                // Simple stemming for keyword tokens to match variations in text
                // e.g. "makes" should match "make", "calling" should match "call"
                let base = token
                if (token.length > 3) {
                    if (token.endsWith('ing')) base = token.slice(0, -3)
                    else if (token.endsWith('ies')) base = token.slice(0, -3) // simple truncation for now
                    else if (token.endsWith('es')) base = token.slice(0, -2)
                    else if (token.endsWith('ed')) base = token.slice(0, -2)
                    else if (token.endsWith('d') && token.toLowerCase().endsWith('ed')) base = token.slice(0, -1) // e.g. tired -> tire
                    else if (token.endsWith('s') && !token.toLowerCase().endsWith('ss')) base = token.slice(0, -1)
                }

                const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                // Allow suffixes for words longer than 2 characters
                return token.length > 2 ? `${escaped}\\w*` : escaped
            })

            // Join with flexible separator (whitespace/punctuation)
            const pattern = `(${patternParts.join('[\\s\\W]+')})`
            const regex = new RegExp(pattern, 'gi')

            const parts = text.split(regex)
            if (parts.length === 1) return text

            return parts.map((part, i) => {
                // Odd indices are the captured matches
                if (i % 2 === 1) {
                    return (
                        <span
                            key={i}
                            style={{
                                color: 'var(--practice-word)',
                                fontWeight: 'bold'
                            }}
                        >
                            {part}
                        </span>
                    )
                }
                return part
            })
        } catch (e) {
            console.error('Error rendering example:', e)
            return text
        }
    }, [vocabSettings.highlightKeywordsInExamples, currentWord])

    // Loading state
    if (loading) {
        return (
            <div
                className="flex h-full flex-col items-center justify-center space-y-4"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
                </div>
                <p className="text-muted-foreground">{t('practice.loading')}</p>
            </div>
        )
    }

    // Completion screen
    if (isComplete && progressKey && bookId) {
        // Clear progress when complete
        localStorage.removeItem(progressKey)

        return (
            <CompletionScreen
                stats={stats}
                bookId={bookId}
                bookName={bookName}
                currentChapter={chapter}
                totalChapters={totalChapters}
                chapterLength={chapterLength}
                onRestart={restart}
                duration={getElapsedTime()}
            />
        )
    }

    if (!currentWord) {
        if (words.length === 0) {
            return (
                <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-3">
                        <p className="text-muted-foreground">{t('practice.noWords')}</p>
                        <button
                            type="button"
                            onClick={() => navigate(`/vocabulary/${bookId}`)}
                            className="glass-control inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t('practice.backToBook')}
                        </button>
                    </div>
                </div>
            )
        }
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">{t('practice.loading')}</div>
            </div>
        )
    }

    return (
        <div
            className="practice-workspace absolute inset-0 flex flex-col bg-background"
            style={{
                '--practice-correct': vocabSettings.correctColor === defaultSettings.vocabulary.correctColor ? undefined : vocabSettings.correctColor,
                '--practice-wrong': vocabSettings.wrongColor === defaultSettings.vocabulary.wrongColor ? undefined : vocabSettings.wrongColor,
            } as CSSProperties}
        >
            {/* Header */}
            <header
                className="shrink-0 grid gap-3 border-b border-border/40 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            navigate(`/vocabulary/${bookId}`)
                        }}
                        className="glass-control group flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition-all hover:border-primary/50 hover:text-primary-ink"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"/>
                    </button>
                    <div className="text-sm font-medium text-foreground">
            <span>
              {t('practice.chapterLabel', {chapter})}
            </span>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    <div
                        className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-3 py-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground"/>
                        <span className="text-xs font-medium tabular-nums text-foreground">
              {getElapsedTime()}
            </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                        <div className="flex items-center gap-2">
              <span>
                {t('practice.progress')} {currentIndex + 1}/{words.length}
              </span>
                            {effectiveExerciseTime > 1 && (
                                <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="tabular-nums">
                    {currentCorrectCount} / {effectiveExerciseTime}
                  </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="h-4 w-px bg-border/60"/>

                    {/* Reset Button */}
                    <button
                        onClick={restart}
                        className="glass-control flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition-all hover:text-foreground"
                        title={t('vocabulary.reset')}
                    >
                        <RotateCcw className="h-4 w-4"/>
                    </button>

                    {/* Familiar Toggle */}
                    <button
                        onClick={toggleFamiliar}
                        className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                            isFamiliar
                                ? "border-warning/60 bg-warning/10 text-warning"
                                : "border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                        title={isFamiliar ? t('practice.unmarkWord') : t('practice.markWord')}
                    >
                        <Star className={cn("h-4 w-4", isFamiliar ? "fill-current" : "")} />
                    </button>

                    {/* Word List Toggle */}
                    <button
                        onClick={() => setShowWordList(!showWordList)}
                        className={cn('glass-primary',
                            "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                            showWordList
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                        title={t('practice.wordList')}
                    >
                        <List className="h-4 w-4"/>
                    </button>
                </div>
            </header>

            {/* Main practice area */}
            <main className="relative flex min-h-0 w-full flex-1 flex-row overflow-hidden">
                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
                    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
                        {/* Shortcuts */}
                        <div className="practice-shortcut-shell">
                            <div className="practice-shortcuts">
                                <button type="button" onClick={primaryShortcuts[0].onClick} disabled={primaryShortcuts[0].disabled} className="glass-control practice-shortcut-edge practice-shortcut-previous">
                                    <span>{primaryShortcuts[0].label}</span>
                                    <kbd className="practice-shortcut-hint">{primaryShortcuts[0].key}</kbd>
                                </button>
                                <div className="practice-shortcuts-center">
                                    {primaryShortcuts.slice(1).map((item) => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={item.onClick}
                                            disabled={item.disabled}
                                            className={cn('glass-control',
                                                'inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium text-foreground/75 transition-colors sm:text-sm',
                                                item.disabled
                                                    ? 'cursor-not-allowed text-muted-foreground'
                                                    : ' '
                                            )}
                                        >
                                            <span className="text-muted-foreground " >{item.label}</span>
                                            <span
                                                className="rounded-full bg-background/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:text-xs">
                                                {item.key}
                                            </span>
                                        </button>
                                    ))}
                                    <div
                                        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-border/20 bg-muted/10 px-2.5 py-1 text-xs font-medium text-foreground/75 sm:text-sm">
                                        <span className="text-muted-foreground "  >{t('practice.jump')}</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder={t('practice.jumpToChapterPlaceholder')}
                                            value={chapterInput}
                                            onChange={(e) => setChapterInput(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    jumpToChapter()
                                                }
                                                e.stopPropagation()
                                            }}
                                            className="glass-field h-6 w-20 rounded-lg border px-2 text-center text-xs font-medium text-foreground/75 placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:h-7"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={nextShortcut.onClick}
                                    disabled={nextShortcut.disabled}
                                    className="glass-control practice-shortcut-edge practice-shortcut-next"
                                >
                                    <span>{nextShortcut.label}</span>
                                    <kbd className="practice-shortcut-hint">{nextShortcut.key}</kbd>
                                </button>
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-1 items-center justify-center py-8">
                            {/* Practice Card */}
                            <div
                                className="relative w-full max-w-3xl"
                            >
                                <div className="practice-stack relative flex w-full flex-col items-center justify-center gap-8 py-4">

                                    {vocabSettings.spellingMode === 'dictation' ? (
                                        // Dictation Mode Layout
                                        <>
                                            {/* 1. Definition (Top) */}
                                            <div className="practice-definition relative w-full text-center order-1">
                                                <div className={cn('w-full px-4 flex flex-col gap-4', showTranslation ? 'thin-scrollbar max-h-[35dvh] overflow-y-auto' : 'overflow-visible')}>
                                                    {(!vocabSettings.wordPosition || vocabSettings.wordPosition === 'top') && (
                                                        <div className="mb-6 flex shrink-0 flex-col items-center justify-center gap-2 pt-2">
                                                            {renderDictationWord()}
                                                        </div>
                                                    )}

                                                    {showTranslation ? (
                                                        <>
                                                            <p
                                                                className="whitespace-pre-line text-center font-medium leading-relaxed"
                                                                style={{
                                                                    fontSize: `${vocabSettings.definitionFontSize}px`,
                                                                    color: 'var(--practice-definition)',
                                                                    fontWeight: vocabSettings.definitionFontWeight
                                                                }}
                                                            >
                                                                {currentWord.definition || currentWord.translation}
                                                            </p>
                                                            {currentWord.examples && currentWord.examples.length > 0 && (
                                                                <div className="mt-6 flex flex-col gap-2 text-center">
                                                                    {currentWord.examples.map((ex, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="rounded-lg px-3 py-2 text-muted-foreground"
                                                                            style={{
                                                                                fontSize: `${vocabSettings.examplesFontSize}px`,
                                                                                color: 'var(--practice-examples)',
                                                                                fontWeight: vocabSettings.examplesFontWeight
                                                                            }}
                                                                        >
                                                                            {renderExample(ex)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div
                                                            className={cn(
                                                                "flex flex-col items-center justify-center text-muted-foreground",
                                                                "h-16 shrink-0"
                                                            )}
                                                        >
                                                            <Keyboard className="mb-3 h-8 w-8 opacity-40"/>
                                                            {/*<p className="text-sm">{t('practice.showHint')}</p>*/}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Input Box (Bottom) */}
                                            <div className="w-full flex flex-col justify-center items-center px-4 order-2 gap-4">
                                                {vocabSettings.wordPosition === 'bottom' && (
                                                    <div className="flex shrink-0 flex-col items-center justify-center gap-2">
                                                        {renderDictationWord()}
                                                    </div>
                                                )}

                                                <input
                                                    type="text"
                                                    value={input}
                                                    onChange={(e) => {
                                                        const newValue = e.target.value

                                                        // Clear any pending error timeout
                                                        if (wrongTimeoutRef.current) {
                                                            clearTimeout(wrongTimeoutRef.current)
                                                            wrongTimeoutRef.current = null
                                                        }

                                                        // Allow backspace/clearing without penalty
                                                        if (newValue.length < input.length) {
                                                            setInput(newValue)
                                                            setInputState('typing') // Reset state on backspace
                                                            return
                                                        }

                                                        const cleanInput = newValue.trim().replace(/\s+/g, ' ')
                                                        const target = currentWord.word.trim().replace(/\s+/g, ' ')

                                                        // Check prefix match
                                                        if (target.toLowerCase().startsWith(cleanInput.toLowerCase())) {
                                                            setInput(newValue)
                                                            setInputState('typing') // Ensure state is valid
                                                            if (!hasStartedTyping) setHasStartedTyping(true)
                                                            if (vocabSettings.autoShowTranslationOnInput) setShowTranslation(true)

                                                            // Check for completion
                                                            if (cleanInput.length === target.length) {
                                                                completeCurrentEntry(cleanInput)
                                                            }
                                                        } else {
                                                            // Mismatch: Show error then clear after delay
                                                            setInput(newValue)
                                                            setInputState('wrong')
                                                            playSound()

                                                            wrongTimeoutRef.current = setTimeout(() => {
                                                                setInput('')
                                                                setInputState('typing')
                                                                wrongTimeoutRef.current = null
                                                            }, vocabSettings.highlightWrongDelay)
                                                        }
                                                    }}
                                                    onKeyDown={handleDictationKeyDown}
                                                    placeholder={t('practice.typeWord')}
                                                    autoFocus
                                                    aria-label={t('practice.typeWord')}
                                                    className="practice-input py-2 px-4 text-center font-medium placeholder:text-muted-foreground placeholder:text-sm"
                                                    style={{
                                                        fontFamily: vocabSettings.wordFontFamily,
                                                        fontSize: `${vocabSettings.wordFontSize}px`,
                                                        fontWeight: vocabSettings.wordFontWeight,
                                                        width: `${Math.max(10, currentWord.word.length + 3)}ch`,
                                                        maxWidth: '100%',
                                                        color: inputState === 'wrong' ? 'var(--practice-wrong)' : inputState === 'correct' ? 'var(--practice-correct)' : undefined
                                                    }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        // Existing "Fill" Mode Layout (Swapped)
                                        <>
                                             {/* Definition (Top) */}
                                            <div className="practice-definition relative w-full text-center order-1">
                                                <div className={cn('w-full px-4 flex flex-col gap-4', showTranslation ? 'thin-scrollbar max-h-[35dvh] overflow-y-auto' : 'overflow-visible')}>
                                                    {showTranslation ? (
                                                        <>
                                                            <p
                                                                className="whitespace-pre-line text-center font-medium leading-relaxed"
                                                                style={{
                                                                    fontSize: `${vocabSettings.definitionFontSize}px`,
                                                                    color: 'var(--practice-definition)',
                                                                    fontWeight: vocabSettings.definitionFontWeight
                                                                }}
                                                            >                            {currentWord.definition || currentWord.translation}
                                                            </p>
                                                            {currentWord.examples && currentWord.examples.length > 0 && (
                                                                <div className="mt-6 flex flex-col gap-2 text-center">
                                                                    {currentWord.examples.map((ex, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="rounded-lg px-3 py-2 text-muted-foreground"
                                                                            style={{
                                                                                fontSize: `${vocabSettings.examplesFontSize}px`,
                                                                                color: 'var(--practice-examples)',
                                                                                fontWeight: vocabSettings.examplesFontWeight
                                                                            }}
                                                                        >
                                                                            {renderExample(ex)}
                                                                        </div>
                                                                    ))}                            </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div
                                                            className="flex h-full flex-col items-center justify-center text-muted-foreground">
                                                            <Keyboard className="mb-3 h-8 w-8 opacity-40"/>
                                                            <p className="text-sm">{t('practice.typeWord')}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Word Rendering (Bottom) */}
                                            <div
                                                className="flex shrink-0 flex-col items-center justify-center gap-6 py-4 text-center order-2"
                                                data-state={inputState}
                                            >
                                                {renderWord()}

                                                {/* Phonetic */}
                                                {getPhonetic() && (
                                                    <div
                                                        className="flex items-center justify-center gap-3 text-muted-foreground">
                                <span
                                    className="font-medium"
                                    style={{fontSize: `${vocabSettings.phoneticFontSize}px`}}
                                >
                                  {getPhonetic()}
                                </span>
                                                        <button
                                                            onClick={playSound}
                                                            className="glass-control rounded-full p-2 transition-colors hover:text-primary-ink"
                                                        >
                                                            <Volume2 className="h-5 w-5"/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                            </div>
                        </div>


                    </div>
                </div>

                {/* Word List Sidebar */}
                <div
                    className={cn(
                        "shrink-0 border-l border-border/40 bg-card overflow-hidden flex flex-col",
                        showWordList ? "w-64 opacity-100" : "w-0 opacity-0"
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                        <span className="text-sm font-medium">{t('practice.wordList')}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {words.map((word, index) => {
                            const isActive = index === currentIndex
                            const isPast = index < currentIndex
                            const isWordFamiliar = familiarWordIds.has(word.id)
                            return (
                                <div
                                    key={word.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        setCurrentIndex(index)
                                        setInput('')
                                        setInputState('typing')
                                        setWrongIndex(-1)
                                        setWrongSpaceIndex(-1)
                                        setHasStartedTyping(false)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter' && e.key !== ' ') return
                                        e.preventDefault()
                                        setCurrentIndex(index)
                                        setInput('')
                                        setInputState('typing')
                                        setWrongIndex(-1)
                                        setWrongSpaceIndex(-1)
                                        setHasStartedTyping(false)
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                                        isActive
                                            ? "bg-primary/10 text-primary-ink font-medium"
                                            : isPast
                                                ? "text-foreground hover:bg-muted/50"
                                                : "text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                    <span className="shrink-0 w-6 text-xs opacity-40 tabular-nums text-right">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                                        <span className="truncate flex-1">{word.word}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                toggleFamiliarForWord(word.id)
                                            }}
                                            className={cn(
                                                'flex h-5 w-5 items-center justify-center rounded-full transition-colors',
                                                isWordFamiliar
                                                    ? 'text-warning'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                            title={isWordFamiliar ? t('practice.unmarkWord') : t('practice.markWord')}
                                        >
                                            <Star className={cn('h-3.5 w-3.5', isWordFamiliar ? 'fill-current' : '')} />
                                        </button>
                                        {isActive && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"/>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </main>
        </div>
    )
}
