import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy, RotateCcw, Clock, ArrowLeft, ArrowRight } from 'lucide-react'

interface PracticeStats {
  total: number
  completed: number
  correct: number
  wrong: number
  startTime: number
}

interface CompletionScreenProps {
  stats: PracticeStats
  bookId: string
  bookName?: string // Added
  currentChapter: number
  totalChapters: number | null
  chapterLength: number
  onRestart: () => void
  duration?: string
}

export function CompletionScreen({
  bookId,
  bookName,
  currentChapter,
  totalChapters,
  chapterLength,
  onRestart,
  duration
}: CompletionScreenProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [chapterInput, setChapterInput] = useState('')

  const jumpToChapter = useCallback(() => {
    if (!bookId) return
    const nextChapter = parseInt(chapterInput, 10)
    if (!Number.isFinite(nextChapter)) return

    let targetChapter = Math.max(1, nextChapter)
    if (totalChapters) {
      targetChapter = Math.min(targetChapter, totalChapters)
    }

    if (targetChapter === currentChapter) {
      setChapterInput('')
      return
    }

    localStorage.removeItem(`practice_progress_${bookId}_${targetChapter}`)
    navigate(
      `/vocabulary/${bookId}/practice?chapter=${targetChapter}&length=${chapterLength}`,
      { replace: true }
    )
    setChapterInput('')
  }, [bookId, chapterInput, totalChapters, currentChapter, navigate, chapterLength])

  const handleNextChapter = useCallback(() => {
    if (!bookId) return
    const nextChapter = currentChapter + 1
    localStorage.removeItem(`practice_progress_${bookId}_${nextChapter}`)
    navigate(
      `/vocabulary/${bookId}/practice?chapter=${nextChapter}&length=${chapterLength}`,
      { replace: true }
    )
  }, [bookId, currentChapter, chapterLength, navigate])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-background p-8">

      <div className="flex flex-1 flex-col items-center justify-center w-full">
        <div
          className="relative z-10 w-full max-w-lg space-y-8 px-6 text-center"
        >
          {/* Trophy icon */}
          <div
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-warning/10 text-warning"
          >
            <Trophy className="h-12 w-12" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('practice.complete')}
            </h1>
            <div className="mt-2 text-muted-foreground flex flex-col items-center gap-1">
                <p>{t('practice.congratulations')}</p>
                {bookName && (
                  <p className="font-medium text-foreground/80 mt-1">
                    {bookName} • {t('practice.chapterLabel', { chapter: currentChapter })}
                  </p>
                )}
            </div>
            {duration && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{duration}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="flex flex-col items-center gap-6 pt-8"
          >
            <div className="flex flex-col items-center gap-4 w-full">
              {(totalChapters === null || currentChapter < totalChapters) && (
                <button
                  onClick={handleNextChapter}
                  className="glass-primary inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0"
                >
                  {t('practice.nextChapter')}
                  <ArrowRight className="h-5 w-5" />
                </button>
              )}

              <button
                  onClick={onRestart}
                  className="glass-control inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl border px-8 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <RotateCcw className="h-5 w-5" />
                {t('practice.practiceAgain')}
              </button>

              <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 shadow-sm backdrop-blur-sm mt-2">
                <span className="pl-1 text-sm font-medium text-muted-foreground">{t('practice.jump')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="#"
                    value={chapterInput}
                    onChange={(e) => setChapterInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        jumpToChapter()
                      }
                      e.stopPropagation()
                    }}
                    className="glass-field h-9 w-16 rounded-lg border px-2 text-center text-sm font-medium shadow-sm focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  />
                  <button
                    onClick={jumpToChapter}
                    disabled={!chapterInput}
                    className="h-9 rounded-lg bg-primary/10 px-4 text-sm font-medium text-primary-ink transition-all hover:bg-primary/20 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/vocabulary/${bookId}`)}
              className="group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary-ink transition-all hover:-translate-y-0.5 hover:bg-primary/15 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              {t('practice.backToBook')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
