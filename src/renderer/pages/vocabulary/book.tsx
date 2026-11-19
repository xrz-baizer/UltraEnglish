import { useEffect, useState, useRef, type MouseEvent } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Play, CheckCircle, Layers, RotateCcw, Download, StarOff, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@renderer/lib/utils'
import { MAX_WORD_REPEAT, normalizeWordRepeat } from '@renderer/lib/vocabulary-repeat'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { Select } from '@renderer/components/ui/select'

interface BookDetail {
  id: string
  name: string
  description: string | null
  wordCount: number
  chapterLength: number
}

interface ChapterProgress {
  chapter: number
  total: number
  completed: number
  accuracy: number
}

interface WordProgressEntry {
  wordId: string
  mastered: boolean
  familiar?: boolean
}

interface WordEntry {
  id: string
}

interface ExportWordEntry extends WordEntry {
  word: string
  definition?: string | null
  translation?: string | null
  phonetic?: string | null
  phoneticUs?: string | null
  phoneticUk?: string | null
  examples?: string | string[] | null
}

const chapterLengthOptions = [50, 100, 200]

function ChapterLengthSetting({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation()
  return (
    <div className="book-setting-row">
      <span>{t('settings.vocabulary.chapterLength')}</span>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('settings.vocabulary.chapterLength')}>
        {!chapterLengthOptions.includes(value) && <span className="book-legacy-length" aria-label={t('vocabulary.currentChapterLength', { count: value })}>{value}</span>}
        {chapterLengthOptions.map(count => (
          <button key={count} aria-pressed={value === count} onClick={() => onChange(count)} className={cn('book-setting-option', value === count && 'is-active')}>
            {count}
          </button>
        ))}
      </div>
    </div>
  )
}

function WordExerciseTimeSetting({ bookId }: { bookId: string }) {
  const { t } = useTranslation()
  const globalValue = useSettingsStore(state => state.settings.vocabulary.wordExerciseTime)
  const storageKey = `book_settings_${bookId}`
  const [overrideValue, setOverrideValue] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      const parsed = stored ? JSON.parse(stored) : null
      return typeof parsed?.wordExerciseTime === 'number' ? normalizeWordRepeat(parsed.wordExerciseTime) : null
    } catch { return null }
  })
  const updateStorage = (value: string) => {
    const next = value ? normalizeWordRepeat(value) : null
    try {
      const stored = localStorage.getItem(storageKey)
      const data = stored ? JSON.parse(stored) : {}
      if (next === null) delete data.wordExerciseTime
      else data.wordExerciseTime = next
      localStorage.setItem(storageKey, JSON.stringify(data))
      setOverrideValue(next)
    } catch { toast.error(t('vocabulary.bookSettingsSaveFailed')) }
  }
  return (
    <label className="book-setting-row">
      <span>{t('vocabulary.repeatPerWord')}</span>
      <Select
        className="book-repeat-select"
        label={t('settings.vocabulary.wordExerciseTime')}
        value={overrideValue === null ? '' : String(overrideValue)}
        onValueChange={updateStorage}
        options={[
          { value: '', label: t('vocabulary.globalRepeat', { count: globalValue }) },
          ...Array.from({ length: MAX_WORD_REPEAT }, (_, index) => ({ value: String(index + 1), label: t('vocabulary.repeatTimes', { count: index + 1 }) }))
        ]}
      />
    </label>
  )
}

export function BookDetailPage() {
  const { t } = useTranslation()
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()

  const [book, setBook] = useState<BookDetail | null>(null)
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [excludeFamiliar, setExcludeFamiliar] = useState(false)
  const [filteredWordCount, setFilteredWordCount] = useState<number | null>(null)
  const [familiarCount, setFamiliarCount] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isResettingFamiliar, setIsResettingFamiliar] = useState(false)

  // Reset functionality
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetTarget, setResetTarget] = useState<'all' | number>('all')
  const [showFamiliarResetConfirm, setShowFamiliarResetConfirm] = useState(false)
  const moreActionsRef = useRef<HTMLButtonElement>(null)
  const resetTriggerRef = useRef<HTMLElement | null>(null)

  const chapterLength = book?.chapterLength ?? 100
  const familiarFilterKey = bookId ? `vocab_filter_familiar_${bookId}` : ''

  const getPracticeProgressIndex = (chapterNumber: number) => {
    if (!bookId) return null
    const key = `practice_progress_${bookId}_${chapterNumber}${excludeFamiliar ? '_nofamiliar' : ''}`
    const savedStateStr = localStorage.getItem(key)
    if (!savedStateStr) return null
    try {
      const parsed = JSON.parse(savedStateStr)
      if (parsed && typeof parsed.index === 'number') {
        return parsed.index
      }
    } catch {
      const idx = parseInt(savedStateStr, 10)
      if (!Number.isNaN(idx)) {
        return idx
      }
    }
    return null
  }

  const hasChapterCompletionMark = (chapterNumber: number) => {
    if (!bookId) return false
    const key = `practice_completed_${bookId}_${chapterNumber}${excludeFamiliar ? '_nofamiliar' : ''}`
    return Boolean(localStorage.getItem(key))
  }

  const loadProgress = async () => {
    if (!bookId) return
    try {
      const [wordsResult, progressResult] = await Promise.all([
        window.electronAPI.getWordsByBook(bookId),
        window.electronAPI.getWordProgress(bookId)
      ])
      const words = wordsResult as WordEntry[]
      const rawProgressList = progressResult as any[]

      // Normalize data
      const progressList = rawProgressList.map((item) => (item.dataValues ? item.dataValues : item)) as WordProgressEntry[]

      const familiarIds = new Set(
        progressList.filter((p) => !!p.familiar).map((p) => p.wordId)
      )

      setFamiliarCount(familiarIds.size)
      const progressMap = new Map(progressList.map((p) => [p.wordId, p]))
      const filteredWords = excludeFamiliar
        ? words.filter((word) => !familiarIds.has(word.id))
        : words

      setFilteredWordCount(filteredWords.length)

      if (filteredWords.length === 0) {
        setChapterProgress([])
        return
      }

      const totalChapters = Math.ceil(filteredWords.length / chapterLength)
      const chapters: ChapterProgress[] = []

      for (let i = 0; i < totalChapters; i += 1) {
        const slice = filteredWords.slice(i * chapterLength, (i + 1) * chapterLength)
        const masteredCount = slice.filter((word) => progressMap.get(word.id)?.mastered).length
        const savedIndex = getPracticeProgressIndex(i + 1)
        const positionCount =
          typeof savedIndex === 'number'
            ? Math.min(Math.max(savedIndex + 1, 0), slice.length)
            : 0
        const completed = hasChapterCompletionMark(i + 1)
          ? slice.length
          : Math.max(masteredCount, positionCount)
        chapters.push({
          chapter: i + 1,
          total: slice.length,
          completed,
          accuracy: 0
        })
      }

      setChapterProgress(chapters)
    } catch (error) {
      console.error('Failed to load chapter progress:', error)
    }
  }

  useEffect(() => {
    if (!bookId) return

    const loadBook = async () => {
      try {
        setLoading(true)
        const result = await window.electronAPI.getVocabularyBookById(bookId)
        setBook(result as BookDetail)
      } catch (error) {
        console.error('Failed to load book:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBook()
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    const stored = localStorage.getItem(familiarFilterKey)
    setExcludeFamiliar(stored === 'true')
  }, [bookId, familiarFilterKey])

  useEffect(() => {
    loadProgress()

    // Listen for progress updates
    const unsubscribe = window.electronAPI.on('word-progress-updated', () => {
      loadProgress()
    })

    // Refresh on focus (e.g. returning from practice)
    const onFocus = () => loadProgress()
    window.addEventListener('focus', onFocus)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [bookId, chapterLength, excludeFamiliar])

  const handleChapterLengthChange = async (value: number) => {
    if (!bookId || !book) return
    if (value === book.chapterLength) return

    const clamped = Math.min(500, Math.max(10, value))
    setBook({ ...book, chapterLength: clamped })

    try {
      await window.electronAPI.updateVocabularyBook(bookId, { chapterLength: clamped })
    } catch (error) {
      console.error('Failed to update chapter length:', error)
    }
  }

  const handleResetClick = (e: MouseEvent<HTMLElement>, target: 'all' | number) => {
    e.preventDefault()
    e.stopPropagation()
    resetTriggerRef.current = e.currentTarget
    setResetTarget(target)
    setShowResetConfirm(true)
  }

  const handleFamiliarFilterToggle = () => {
    if (!bookId) return
    const nextValue = !excludeFamiliar
    setExcludeFamiliar(nextValue)
    localStorage.setItem(familiarFilterKey, String(nextValue))
  }

  const handleConfirmReset = async () => {
    if (!bookId) return

    try {
      if (resetTarget === 'all') {
        await window.electronAPI.resetWordProgress(bookId)
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i)
          if (!key) continue
          if (key.startsWith(`practice_progress_${bookId}_`) || key.startsWith(`practice_completed_${bookId}_`)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
      } else {
        // Reset specific chapter
        const words = await window.electronAPI.getWordsByBook(bookId, resetTarget, chapterLength) as any[]
        const wordIds = words.map(w => w.id)
        if (wordIds.length > 0) {
          await window.electronAPI.resetWordProgress(bookId, wordIds)
        }
        const progressKey = `practice_progress_${bookId}_${resetTarget}${excludeFamiliar ? '_nofamiliar' : ''}`
        const completedKey = `practice_completed_${bookId}_${resetTarget}${excludeFamiliar ? '_nofamiliar' : ''}`
        localStorage.removeItem(progressKey)
        localStorage.removeItem(completedKey)
      }
      await loadProgress()
    } catch (error) {
      console.error('Failed to reset progress:', error)
    } finally {
      setShowResetConfirm(false)
    }
  }

  const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '').trim()
  const getDirName = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    return idx > -1 ? normalized.slice(0, idx) : normalized
  }

  const parseExamples = (examples: ExportWordEntry['examples']) => {
    if (!examples) return undefined
    if (Array.isArray(examples)) {
      const filtered = examples.filter((item) => typeof item === 'string' && item.trim())
      return filtered.length ? filtered : undefined
    }
    if (typeof examples === 'string') {
      try {
        const parsed = JSON.parse(examples)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item) => typeof item === 'string' && item.trim())
          return filtered.length ? filtered : undefined
        }
      } catch {
        // fall through
      }
      const trimmed = examples.trim()
      return trimmed ? [trimmed] : undefined
    }
    return undefined
  }

  const buildTrans = (word: ExportWordEntry) => {
    const base = (word.definition || word.translation || '').trim()
    if (!base) return []
    return base.split(/\n+/).map((item) => item.trim()).filter(Boolean)
  }

  const handleExportFamiliar = async () => {
    if (!bookId || !book) return
    setIsExporting(true)
    try {
      const [wordsResult, progressResult] = await Promise.all([
        window.electronAPI.getWordsByBook(bookId),
        window.electronAPI.getWordProgress(bookId)
      ])
      const words = wordsResult as ExportWordEntry[]
      const rawProgressList = progressResult as any[]

      // Normalize data
      const progressList = rawProgressList.map((item) => (item.dataValues ? item.dataValues : item)) as WordProgressEntry[]

      const familiarIds = new Set(
        progressList.filter((p) => !!p.familiar).map((p) => p.wordId)
      )

      if (familiarIds.size === 0) return

      const familiarWords = words.filter((word) => familiarIds.has(word.id))
      if (familiarWords.length === 0) return

      const payload = familiarWords.map((word) => {
        const trans = buildTrans(word)
        const entry: Record<string, unknown> = {
          name: word.word,
          trans: trans.length ? trans : [''],
          usphone: word.phoneticUs ?? word.phonetic ?? '',
          ukphone: word.phoneticUk ?? ''
        }
        const examples = parseExamples(word.examples)
        if (examples && examples.length) {
          entry.examples = examples
        }
        return entry
      })

      const dateTag = new Date().toISOString().slice(0, 10)
      const safeBookName = sanitizeFileName(book.name || 'vocabulary') || 'vocabulary'
      const fileName = `${safeBookName}-familiar-words-${dateTag}.json`
      const result = await window.electronAPI.saveTextFileToDownloads({
        content: `${JSON.stringify(payload, null, 2)}\n`,
        suggestedName: fileName
      })
      if (result?.success && result.filePath) {
        const folderPath = getDirName(result.filePath)
        await window.electronAPI.openFolder(folderPath)
        toast.success(t('vocabulary.exportFamiliarSuccess'))
      }
    } catch (error) {
      console.error('Failed to export familiar words:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleConfirmResetFamiliar = async () => {
    if (!bookId) return
    setIsResettingFamiliar(true)
    try {
      const rawProgressResult = await window.electronAPI.getWordProgress(bookId) as any[]
      // Normalize data
      const progressList = rawProgressResult.map((item) => (item.dataValues ? item.dataValues : item)) as WordProgressEntry[]

      const familiarIds = new Set(
        progressList.filter((p) => !!p.familiar).map((p) => p.wordId)
      )

      if (familiarIds.size > 0) {
        // Use the new batch API if possible, or parallel requests
        // Since we didn't add batch API to book.tsx interface usage yet, let's stick to parallel
        // Actually, let's use the new batch API for better performance!
        // But wait, I added it to preload but typescript might complain if I didn't update the types in book.tsx?
        // The preload modification was global, so window.electronAPI should have it.
        // Let's use batch since I exposed it.

        // Wait, did I add setWordFamiliarBatch to ElectronAPI interface? Yes.
        await window.electronAPI.setWordFamiliarBatch(Array.from(familiarIds), false)
      }

      await loadProgress()
    } catch (error) {
      console.error('Failed to reset familiar status:', error)
    } finally {
      setIsResettingFamiliar(false)
      setShowFamiliarResetConfirm(false)
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Back button skeleton */}
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />

        {/* Book info skeleton */}
        <div className="flex items-start gap-6">
          <div className="h-20 w-20 animate-pulse rounded-2xl bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-muted"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Not found state
  if (!book) {
    return (
      <div
        className="flex h-[60vh] flex-col items-center justify-center space-y-6"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-muted">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('vocabulary.bookNotFound')}
          </h2>
          <button
            onClick={() => navigate('/vocabulary')}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-ink transition-colors hover:text-primary-ink/80"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  const displayWordCount =
    excludeFamiliar && filteredWordCount !== null ? filteredWordCount : book.wordCount
  const totalChapters = chapterProgress.length
  const chapters = chapterProgress
  const showEmptyState = filteredWordCount === 0

  return (
    <div className="book-detail space-y-3 p-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/vocabulary')}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50">
          <ArrowLeft className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium">
          {t('common.back')}
        </span>
      </button>

      <div className="book-overview rounded-xl border border-border/50 bg-card">
        <div className="book-overview-info">
          <BookOpen className="h-8 w-8 shrink-0 text-primary-ink" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold tracking-tight">{book.name}</h1>
            {book.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground" title={book.description}>{book.description}</p>}
            <div className="book-summary text-sm text-muted-foreground">
              <span>{t('vocabulary.words', { count: displayWordCount })}</span>
              <span>{t('vocabulary.chapters', { count: totalChapters })}</span>
              <span>{t('vocabulary.familiarWords', { count: familiarCount })}</span>
            </div>
          </div>
        </div>
        <div className="book-settings" role="group" aria-label={t('vocabulary.practiceSettings')}>
          <ChapterLengthSetting value={chapterLength} onChange={handleChapterLengthChange} />
          <WordExerciseTimeSetting key={bookId} bookId={bookId!} />
        </div>
      </div>

      <div className="book-chapter-toolbar">
        <h2 className="text-base font-semibold">{t('vocabulary.selectChapter')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="book-filter-control" htmlFor="book-familiar-filter">
            <span>{t('vocabulary.filterFamiliar')}</span>
            <button id="book-familiar-filter" type="button" role="switch" aria-checked={excludeFamiliar} aria-label={t('vocabulary.filterFamiliar')} onClick={handleFamiliarFilterToggle} className="inline-note-switch book-filter-toggle">
              <span aria-hidden="true" />
            </button>
          </label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button ref={moreActionsRef} className="icon-button" aria-label={t('common.moreActions')} title={t('common.moreActions')}><MoreHorizontal className="h-5 w-5" aria-hidden="true" /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="book-actions-menu" sideOffset={6} align="end" onCloseAutoFocus={event => { if (showResetConfirm || showFamiliarResetConfirm) event.preventDefault() }}>
                <DropdownMenu.Item disabled={isExporting || familiarCount === 0} onSelect={() => void handleExportFamiliar()}>
                  <Download className="h-4 w-4" aria-hidden="true" />{t('vocabulary.exportFamiliar')}
                </DropdownMenu.Item>
                <DropdownMenu.Item disabled={isResettingFamiliar || familiarCount === 0} onSelect={() => { resetTriggerRef.current = moreActionsRef.current; setShowFamiliarResetConfirm(true) }}>
                  <StarOff className="h-4 w-4" aria-hidden="true" />{t('vocabulary.resetFamiliar')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={() => { resetTriggerRef.current = moreActionsRef.current; setResetTarget('all'); setShowResetConfirm(true) }}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />{t('vocabulary.resetAllProgress')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Chapter grid */}
      {!showEmptyState ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {chapters.map(({ chapter, total, completed }) => {
            const isCompleted = completed === total && total > 0
            const hasProgress = completed > 0
            const progressPercent = total > 0 ? (completed / total) * 100 : 0

            return (
              <div key={chapter} className="group relative rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-muted/30">
                <NavLink
                  to={`/vocabulary/${bookId}/practice?chapter=${chapter}&length=${chapterLength}`}
                  className="block rounded-xl p-3.5"
                >
                  <div className="relative">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      {/* Chapter indicator */}
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300',
                          isCompleted
                            ? 'bg-primary'
                            : 'bg-muted group-hover:bg-primary/10'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Layers className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary-ink" />
                        )}
                      </div>

                      <div className={cn('flex items-center gap-1', hasProgress && 'mr-9')}>
                        {/* Play button */}
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Play className="h-3 w-3 fill-current" />
                        </div>
                      </div>
                    </div>

                    {/* Chapter title */}
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {t('vocabulary.chapter')} {chapter}
                    </h3>

                    {/* Progress info */}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {completed} / {total}
                    </p>

                    {/* Progress bar */}
                    {hasProgress && (
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isCompleted
                              ? 'bg-primary'
                              : 'bg-primary'
                          )}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </NavLink>
                {hasProgress && (
                  <button
                    onClick={(event) => handleResetClick(event, chapter)}
                    className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t('vocabulary.resetChapterNumber', { chapter })}
                    title={t('vocabulary.resetChapterProgress')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-border/50 bg-card px-6 py-10 text-sm text-muted-foreground">
          {t('vocabulary.noWordsAfterFilter')}
        </div>
      )}

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm" onCloseAutoFocus={event => { event.preventDefault(); resetTriggerRef.current?.focus() }}>
          <DialogTitle>{t(resetTarget === 'all' ? 'vocabulary.resetAllProgress' : 'vocabulary.resetChapterProgress')}</DialogTitle>
          <DialogDescription>{t('vocabulary.resetConfirm')}</DialogDescription>
          <div className="mt-2 flex justify-end gap-3">
            <button className="secondary-button" onClick={() => setShowResetConfirm(false)}>{t('common.cancel')}</button>
            <button className="primary-button" onClick={handleConfirmReset}>{t('common.confirm')}</button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showFamiliarResetConfirm} onOpenChange={setShowFamiliarResetConfirm}>
        <DialogContent className="max-w-sm" onCloseAutoFocus={event => { event.preventDefault(); resetTriggerRef.current?.focus() }}>
          <DialogTitle>{t('vocabulary.resetFamiliarTitle')}</DialogTitle>
          <DialogDescription>{t('vocabulary.resetFamiliarConfirm')}</DialogDescription>
          <div className="mt-2 flex justify-end gap-3">
            <button className="secondary-button" onClick={() => setShowFamiliarResetConfirm(false)}>{t('common.cancel')}</button>
            <button className="primary-button" disabled={isResettingFamiliar} onClick={handleConfirmResetFamiliar}>{t('common.confirm')}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
