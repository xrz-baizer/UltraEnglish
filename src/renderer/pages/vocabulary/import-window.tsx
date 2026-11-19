import { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Upload } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { getVocabularyCategories } from '@renderer/lib/vocabulary-categories'

const CATEGORY_LABEL_MAP: Record<string, string> = {
  '考研': 'vocabulary.categoryLabels.postgraduate',
  '四六级': 'vocabulary.categoryLabels.cet',
  '四级': 'vocabulary.categoryLabels.cet',
  '托福': 'vocabulary.categoryLabels.toefl',
  '雅思': 'vocabulary.categoryLabels.ielts',
  'GRE': 'vocabulary.categoryLabels.gre',
  'SAT': 'vocabulary.categoryLabels.sat',
  '其他': 'vocabulary.categoryLabels.other'
}

const BOOK_TYPE_OPTIONS = [
  { value: 'word', labelKey: 'vocabulary.bookTypeWord' },
  { value: 'sentence', labelKey: 'vocabulary.bookTypeSentence' }
] as const

const getBaseName = (filePath: string) => {
  const fileName = filePath.split(/[\\/]/).pop() || ''
  return fileName.replace(/\.[^.]+$/, '')
}

export function ImportVocabularyWindow() {
  const { t } = useTranslation()
  const { settings, loadSettings } = useSettingsStore()
  const { customCategories, categoryOrder } = settings.vocabulary

  const [filePath, setFilePath] = useState('')
  const [bookName, setBookName] = useState('')
  const [category, setCategory] = useState('其他')
  const [bookType, setBookType] = useState<'word' | 'sentence'>('word')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Computed available categories
  const allCategories = getVocabularyCategories(customCategories, categoryOrder)

  useLayoutEffect(() => {
    document.body.classList.add('no-scrollbar')
    document.documentElement.classList.add('no-scrollbar')

    // ... existing cleanup
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        window.close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.classList.remove('no-scrollbar')
      document.documentElement.classList.remove('no-scrollbar')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSelectFile = async () => {
    setError(null)
    try {
      const result = await window.electronAPI.selectVocabularyBookFile()
      if (result.canceled || !result.filePath) return
      setFilePath(result.filePath)
      setBookName(getBaseName(result.filePath))
    } catch (err) {
      console.error('Failed to select file:', err)
      setError(t('common.error'))
    }
  }

  const handleImport = async () => {
    if (!filePath) {
      setError(t('vocabulary.importFileRequired'))
      return
    }
    if (!bookName.trim()) {
      setError(t('vocabulary.importNameRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await window.electronAPI.importVocabularyBookWithMeta({
        filePath,
        name: bookName.trim(),
        category,
        bookType
      }) as { success?: boolean; error?: string }

      if (result?.success === false) {
        setError(result.error || t('common.error'))
        return
      }

      window.close()
    } catch (err) {
      console.error('Import failed:', err)
      setError(t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-full flex-col px-4 py-4">
        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/25">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{t('vocabulary.importTitle')}</h1>

          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1">
          <div className="flex flex-1 flex-col rounded-2xl border border-border/60 bg-card/70 shadow-sm">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('vocabulary.importFile')}</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 truncate rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
                          {filePath ? getBaseName(filePath) : t('vocabulary.importFilePlaceholder')}
                        </div>
                        <button
                          onClick={handleSelectFile}
                          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary-ink"
                        >
                          <Upload className="h-4 w-4" />
                          {t('vocabulary.importChooseFile')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('vocabulary.importBookName')}</label>
                    <input
                      type="text"
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      placeholder={t('vocabulary.importBookNamePlaceholder')}
                      className="glass-field w-full rounded-lg border px-3 py-1.5 text-sm font-medium text-foreground transition-all focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('vocabulary.importCategory')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {allCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={cn('glass-primary',
                            'truncate rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                            category === cat
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          title={cat}
                        >
                          {CATEGORY_LABEL_MAP[cat] ? t(CATEGORY_LABEL_MAP[cat]) : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('vocabulary.importBookType')}</label>
                    <div className="flex gap-2">
                      {BOOK_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setBookType(option.value)}
                          className={cn('glass-primary',
                            'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                            bookType === option.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          {t(option.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/50 p-4">
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => window.close()}
                  className="glass-control rounded-lg border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleImport}
                  disabled={submitting}
                  className="glass-primary rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('vocabulary.importConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
