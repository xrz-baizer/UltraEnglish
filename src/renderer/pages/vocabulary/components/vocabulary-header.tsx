import { useTranslation } from 'react-i18next'
import { FolderEdit, Trash2, Settings2, Plus, Loader2 } from 'lucide-react'

interface VocabularyHeaderProps {
  booksCount: number
  totalWords: number
  totalCategories: number
  importing: boolean
  isManaging: boolean
  selectedCount: number
  onManage: () => void
  onImport: () => void
  onEditCategory: () => void
  onDeleteSelected: () => void
  onManageCategories: () => void
  onDone: () => void
}

export function VocabularyHeader({
  booksCount,
  totalWords,
  totalCategories,
  importing,
  isManaging,
  selectedCount,
  onManage,
  onImport,
  onEditCategory,
  onDeleteSelected,
  onManageCategories,
  onDone
}: VocabularyHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="library-heading">
      <div className="page-heading">

        <h1>{t('shell.vocabulary')}</h1>

        <div className="library-meta">
          <span>
            {booksCount} {t('vocabulary.books')}
          </span>
          <span>{t('vocabulary.words', { count: totalWords })}</span>
          <span>
            {totalCategories} {t('vocabulary.categories')}
          </span>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          {isManaging ? (
            <>
              <button
                onClick={() => selectedCount > 0 && onEditCategory()}
                disabled={selectedCount === 0}
                className="glass-control inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-foreground transition-all disabled:opacity-50 sm:w-auto"
              >
                <FolderEdit className="h-4 w-4" />
                {t('common.move', 'Move')} ({selectedCount})
              </button>
              <button
                onClick={() => selectedCount > 0 && onDeleteSelected()}
                disabled={selectedCount === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive transition-all hover:bg-destructive/10 disabled:opacity-50 sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')} ({selectedCount})
              </button>
              <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
              <button onClick={onDone} className="primary-button">
                {t('common.done', 'Done')}
              </button>
            </>
          ) : (
            <>
              <button onClick={onManageCategories} className="secondary-button">
                <FolderEdit className="h-4 w-4" />
                {t('vocabulary.manageCategories', 'Manage Categories')}
              </button>
              <button onClick={onManage} disabled={booksCount === 0} className="secondary-button">
                <Settings2 className="h-4 w-4" />
                {t('common.manage', 'Manage')}
              </button>
              <button onClick={onImport} disabled={importing} className="primary-button">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                )}
                {t('vocabulary.addBook', 'Add Book')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
