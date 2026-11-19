import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Lock, Check } from 'lucide-react'
import { type VocabularyBook } from '../vocabulary-types'

interface VocabularyBookGridProps {
  groupedBooks: Record<string, VocabularyBook[]>
  orderedCategories: string[]
  getCategoryLabel: (category: string) => string
  isManaging: boolean
  selectedBooks: Set<string>
  onToggleSelection: (id: string) => void
}

export function VocabularyBookGrid({
  groupedBooks,
  orderedCategories,
  getCategoryLabel,
  isManaging,
  selectedBooks,
  onToggleSelection
}: VocabularyBookGridProps) {
  const { t } = useTranslation()
  return (
    <div className="book-sections">
      {orderedCategories.filter(category => groupedBooks[category]?.length).map(category => (
        <section key={category}>
          <div className="section-heading">
            <h2>{getCategoryLabel(category)}</h2>
            <span>
              {groupedBooks[category].length} {t('vocabulary.books')}
            </span>
          </div>
          <div className="surface-panel book-list">
            {groupedBooks[category].map((book) => {
              const content = (
                <>
                  <span className="book-cover" aria-hidden="true">
                    <BookOpen size={23} strokeWidth={1.4} />
                  </span>
                  <span className="book-info">
                    <strong>{book.name}</strong>
                    <small>
                      {book.description || t('vocabulary.words', { count: book.wordCount })}
                    </small>
                  </span>
                  <span className="book-word-count">
                    {t('vocabulary.words', { count: book.wordCount })}
                  </span>
                  {book.isBuiltIn && <span className="quiet-badge">{t('vocabulary.builtIn')}</span>}
                  {isManaging ? (
                    book.isBuiltIn ? (
                      <Lock size={16} aria-label={t('vocabulary.builtIn')} />
                    ) : (
                      <span
                        className={`selection-box ${selectedBooks.has(book.id) ? 'is-selected' : ''}`}
                        aria-hidden="true"
                      >
                        {selectedBooks.has(book.id) && <Check size={13} />}
                      </span>
                    )
                  ) : (
                    <ChevronRight size={17} aria-hidden="true" />
                  )}
                </>
              )
              return isManaging ? (
                <button
                  key={book.id}
                  className="book-row"
                  disabled={book.isBuiltIn}
                  aria-pressed={selectedBooks.has(book.id)}
                  onClick={() => onToggleSelection(book.id)}
                >
                  {content}
                </button>
              ) : (
                <NavLink key={book.id} className="book-row" to={`/vocabulary/${book.id}`}>
                  {content}
                </NavLink>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
