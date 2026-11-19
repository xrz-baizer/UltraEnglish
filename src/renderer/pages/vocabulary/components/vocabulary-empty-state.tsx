import { useTranslation } from 'react-i18next'
import { BookOpen, Plus, Loader2 } from 'lucide-react'

export function VocabularyEmptyState({
  importing,
  onImport
}: {
  importing: boolean
  onImport: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="surface-panel library-empty">
      <BookOpen size={42} strokeWidth={1.2} className="text-muted-foreground" aria-hidden="true" />
      <h2>{t('vocabulary.noBooks')}</h2>

      <button onClick={onImport} disabled={importing} className="primary-button">
        {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {t('vocabulary.addBook')}
      </button>
    </div>
  )
}
