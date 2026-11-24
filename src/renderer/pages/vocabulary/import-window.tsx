import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Download, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { getVocabularyCategories } from '@renderer/lib/vocabulary-categories'
import { Select } from '@renderer/components/ui/select'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@renderer/components/ui/dialog'
import vocabularyTemplate from './vocabulary-template.json?raw'

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

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || ''
}

export function ImportVocabularyWindow() {
  const { t } = useTranslation()
  const { customCategories, categoryOrder } = useSettingsStore((state) => state.settings.vocabulary)

  const [filePath, setFilePath] = useState('')
  const [bookName, setBookName] = useState('')
  const [category, setCategory] = useState('其他')
  const [bookType, setBookType] = useState<'word' | 'sentence'>('word')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const allCategories = getVocabularyCategories(customCategories, categoryOrder)
  const fileName = getFileName(filePath)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        window.close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const result = await window.electronAPI.saveTextFileToDownloads({
        content: vocabularyTemplate,
        suggestedName: 'vocabulary-template.json',
        showInFolder: true
      })
      if (result.success) toast.success(t('vocabulary.importTemplateDownloaded'))
      else toast.error(t('vocabulary.importTemplateError'))
    } catch (err) {
      console.error('Failed to download vocabulary template:', err)
      toast.error(t('vocabulary.importTemplateError'))
    } finally {
      setDownloading(false)
    }
  }

  const handleSelectFile = async () => {
    setError(null)
    try {
      const result = await window.electronAPI.selectVocabularyBookFile()
      if (result.canceled || !result.filePath) return
      setFilePath(result.filePath)
      setBookName(getFileName(result.filePath).replace(/\.[^.]+$/, ''))
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
    <form
      className="vocabulary-import-window flex h-dvh flex-col overflow-hidden bg-background"
      onSubmit={(event) => {
        event.preventDefault()
        if (!submitting) void handleImport()
      }}
    >
      <header className="drag-region flex shrink-0 items-center gap-3 px-6 pb-3 pt-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <BookOpen size={18} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">{t('vocabulary.importTitle')}</h1>
      </header>

      <div className="vocabulary-import-fields min-h-0 flex flex-1 flex-col justify-between gap-3 px-6 pb-4 pt-2">
        <section className="space-y-2 rounded-xl border border-border bg-card p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium">{t('vocabulary.importFile')}</h2>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
                >
                  {t('vocabulary.importViewTemplate')}
                </button>
              </DialogTrigger>
              <DialogContent
                className="flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-xl flex-col overflow-hidden rounded-2xl p-4"
                aria-describedby={undefined}
                hideCloseButton
              >
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <DialogTitle>{t('vocabulary.importTemplateTitle')}</DialogTitle>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDownloadTemplate()}
                      className="secondary-button"
                      disabled={downloading}
                    >
                      <Download size={16} aria-hidden="true" />
                      {t('vocabulary.importDownloadTemplate')}
                    </button>
                    <DialogClose className="icon-button" aria-label={t('common.close')}>
                      <X size={18} aria-hidden="true" />
                    </DialogClose>
                  </div>
                </div>
                <pre tabIndex={0} className="thin-scrollbar min-h-0 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground">
                  <code>{vocabularyTemplate.trimEnd()}</code>
                </pre>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2">
            <p id="import-file-name" className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground" title={fileName || undefined}>
              {fileName || t('vocabulary.importFilePlaceholder')}
            </p>
            <button
              type="button"
              onClick={() => void handleSelectFile()}
              disabled={submitting}
              className="secondary-button shrink-0"
              aria-describedby="import-file-name"
            >
              <Upload size={16} aria-hidden="true" />
              {t('vocabulary.importChooseFile')}
            </button>
          </div>
        </section>

        <div className="space-y-1.5">
          <label htmlFor="import-book-name" className="block text-sm font-medium">{t('vocabulary.importBookName')}</label>
          <input
            id="import-book-name"
            type="text"
            value={bookName}
            onChange={(event) => setBookName(event.target.value)}
            placeholder={t('vocabulary.importBookNamePlaceholder')}
            className="glass-field h-9 w-full rounded-lg border px-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t('vocabulary.importCategory')}</span>
            <Select
              label={t('vocabulary.importCategory')}
              className="w-full"
              value={category}
              onValueChange={setCategory}
              options={allCategories.map((value) => ({
                value,
                label: CATEGORY_LABEL_MAP[value] ? t(CATEGORY_LABEL_MAP[value]) : value
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t('vocabulary.importBookType')}</span>
            <Select
              label={t('vocabulary.importBookType')}
              className="w-full"
              value={bookType}
              onValueChange={(value) => setBookType(value === 'sentence' ? 'sentence' : 'word')}
              options={BOOK_TYPE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            />
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/50 px-6 py-3">
        {error && <p role="alert" className="min-w-0 flex-1 basis-40 break-words text-sm text-destructive">{error}</p>}
        <div className="ms-auto flex shrink-0 gap-2">
          <button type="button" className="secondary-button" onClick={() => window.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? t('common.loading') : t('vocabulary.importConfirm')}
          </button>
        </div>
      </footer>
    </form>
  )
}
