import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Trash2, X, Search, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog'
import { cn } from '@renderer/lib/utils'
import { DEFAULT_VOCABULARY_CATEGORIES as DEFAULT_CATEGORIES, getVocabularyCategories } from '@renderer/lib/vocabulary-categories'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { VocabularyHeader } from './components/vocabulary-header'
import { VocabularyEmptyState } from './components/vocabulary-empty-state'
import { VocabularyBookGrid } from './components/vocabulary-book-grid'
import { type VocabularyBook } from './vocabulary-types'
import { Plus } from 'lucide-react'

export function VocabularyPage() {
  const { t } = useTranslation()
  const { settings, isLoading: settingsLoading, updateVocabularySettings } = useSettingsStore()
  const { customCategories, categoryOrder } = settings.vocabulary

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [books, setBooks] = useState<VocabularyBook[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  // Book management state
  const [isManaging, setIsManaging] = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set())

  // Modals state
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false)
  const [editCategory, setEditCategory] = useState('')
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [dropCategory, setDropCategory] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const bookScrollRef = useRef<HTMLDivElement>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  // Combined categories for display
  const allCategories = getVocabularyCategories(customCategories, categoryOrder, books.map(book => book.category || '其他'))

  useEffect(() => {
    bookScrollRef.current?.scrollTo({ top: 0 })
    categoryScrollRef.current?.scrollTo({ left: 0 })
  }, [categoryOrder])

  const moveCategory = async (category: string, target: string) => {
    if (savingOrder || category === target) return
    const from = allCategories.indexOf(category)
    const to = allCategories.indexOf(target)
    if (from < 0 || to < 0) return
    const nextOrder = [...allCategories]
    nextOrder.splice(from, 1)
    nextOrder.splice(to, 0, category)
    setSavingOrder(true)
    try {
      await updateVocabularySettings({ categoryOrder: nextOrder })
      if (JSON.stringify(useSettingsStore.getState().settings.vocabulary.categoryOrder) !== JSON.stringify(nextOrder)) {
        toast.error(t('vocabulary.categoryOrderFailed'))
      }
    } finally {
      setSavingOrder(false)
    }
  }


  const loadBooks = useCallback(async () => {
    // Category discovery must not persist the default settings over saved order
    // while the app is still loading its settings from SQLite.
    if (useSettingsStore.getState().isLoading) return
    try {
      const result = await window.electronAPI.getVocabularyBooks()
      let loadedBooks = result as VocabularyBook[]

      // Migration Logic
      const migrationUpdates: Promise<any>[] = []

      loadedBooks.forEach(book => {
        if (book.category === '四六级') {
          migrationUpdates.push(window.electronAPI.updateVocabularyBook(book.id, { category: '四级' }))
        } else if (book.category === 'basic') {
          migrationUpdates.push(window.electronAPI.updateVocabularyBook(book.id, { category: '其他' }))
        }

      })

      if (migrationUpdates.length > 0) {
        await Promise.all(migrationUpdates)
        // Reload books after migration
        const updatedResult = await window.electronAPI.getVocabularyBooks()
        loadedBooks = updatedResult as VocabularyBook[]
      }

      // Sync unknown categories to customCategories
      const uniqueCategories = new Set(loadedBooks.map(b => b.category).filter(Boolean) as string[])
      const knownCategories = new Set([...DEFAULT_CATEGORIES, ...customCategories])
      const newCustomCategories: string[] = []

      uniqueCategories.forEach(cat => {
        if (!knownCategories.has(cat)) {
          newCustomCategories.push(cat)
        }
      })

      if (newCustomCategories.length > 0) {
        await updateVocabularySettings({
          customCategories: [...customCategories, ...newCustomCategories]
        })
      }

      setBooks(loadedBooks)
    } catch (error) {
      console.error('Failed to load vocabulary books:', error)
    } finally {
      setLoading(false)
    }
  }, [customCategories, updateVocabularySettings])

  useEffect(() => {
    if (!settingsLoading) void loadBooks()
  }, [loadBooks, settingsLoading])

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('vocabulary-books-updated', () => {
      loadBooks()
    })

    return () => {
      unsubscribe()
    }
  }, [loadBooks])

  useEffect(() => {
    setSelectedBooks((prev) => {
      const filtered = new Set(
        Array.from(prev).filter((id) => !books.find((book) => book.id === id)?.isBuiltIn)
      )
      return filtered
    })
  }, [books])

  const isBuiltInBook = useCallback(
    (id: string) => books.find((book) => book.id === id)?.isBuiltIn,
    [books]
  )

  const handleImport = async () => {
    if (importing) return
    setImporting(true)
    try {
      await window.electronAPI.openVocabularyImportWindow()
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      setImporting(false)
    }
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    if (isBuiltInBook(id)) return
    setSelectedBooks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Bulk Delete
  const handleBulkDelete = async () => {
    try {
      // Execute all deletes
      await Promise.all(Array.from(selectedBooks).map(id => window.electronAPI.deleteVocabularyBook(id)))
      await loadBooks()
      setSelectedBooks(new Set())
      setIsManaging(false)
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setShowDeleteConfirmModal(false)
    }
  }

  // Bulk Update Category
  const handleBulkUpdateCategory = async () => {
    try {
      await Promise.all(
        Array.from(selectedBooks).map(id =>
          window.electronAPI.updateVocabularyBook(id, { category: editCategory })
        )
      )
      await loadBooks()
      setSelectedBooks(new Set())
      setIsManaging(false)
    } catch (error) {
      console.error('Update error:', error)
    } finally {
      setShowEditCategoryModal(false)
    }
  }

  // Manage Categories
  const handleAddCategory = async () => {
    if (!newCategoryInput.trim()) return
    const category = newCategoryInput.trim()
    if (allCategories.includes(category)) return

    await updateVocabularySettings({
      customCategories: [...customCategories, category]
    })
    setNewCategoryInput('')
  }

  const handleDeleteCategory = async (categoryToDelete: string) => {
    // Move books in this category to '其他'
    const booksToMove = books.filter(b => b.category === categoryToDelete)
    if (booksToMove.length > 0) {
      await Promise.all(
        booksToMove.map(b => window.electronAPI.updateVocabularyBook(b.id, { category: '其他' }))
      )
      await loadBooks()
    }

    // Remove from settings
    await updateVocabularySettings({
      customCategories: customCategories.filter(c => c !== categoryToDelete),
      categoryOrder: categoryOrder.filter(c => c !== categoryToDelete)
    })
  }

  // Group books by category
  const visibleBooks = books.filter(book => (categoryFilter === 'all' || (book.category || '其他') === categoryFilter) && `${book.name} ${book.description || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const groupedBooks = visibleBooks.reduce(
    (acc, book) => {
      const category = book.category || '其他'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(book)
      return acc
    },
    {} as Record<string, VocabularyBook[]>
  )
  const totalWords = books.reduce((total, book) => total + book.wordCount, 0)
  const totalCategories = new Set(books.map(book => book.category || '其他')).size
  const orderedCategories = allCategories

  // Simplified label logic
  const getCategoryLabel = (category: string) => category

  // Loading skeleton
  if (loading) {
    return (
      <div className="content-container space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-xl bg-muted" />
        </div>

        {/* Cards skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-5"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="content-container vocabulary-page">
      <VocabularyHeader
        booksCount={books.length}
        totalWords={totalWords}
        totalCategories={totalCategories}
        importing={importing}
        isManaging={isManaging}
        selectedCount={selectedBooks.size}
        onManage={() => setIsManaging(true)}
        onImport={handleImport}
        onEditCategory={() => setShowEditCategoryModal(true)}
        onDeleteSelected={() => setShowDeleteConfirmModal(true)}
        onManageCategories={() => setShowManageCategoriesModal(true)}
        onDone={() => {
          setIsManaging(false)
          setSelectedBooks(new Set())
        }}
      />

      <div className="library-filters">
        <div ref={categoryScrollRef} className="category-segments" aria-label={t('design.filterCategory')}>
          {['all', ...orderedCategories.filter(category => books.some(book => (book.category || '其他') === category))].map(category => <button key={category} aria-pressed={categoryFilter === category} className={categoryFilter === category ? 'is-active' : ''} onClick={() => setCategoryFilter(category)}>{category === 'all' ? t('design.allBooks') : category}</button>)}
        </div>
        <label className="search-field"><Search size={16} aria-hidden="true" /><input type="search" aria-label={t('design.searchBooks')} placeholder={t('design.searchBooks')} value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      {/* Book list */}
      <div ref={bookScrollRef} className="vocabulary-book-scroll">
      {books.length === 0 ? (
        <VocabularyEmptyState importing={importing} onImport={handleImport} />
      ) : visibleBooks.length === 0 ? <div className="surface-panel search-empty"><p>{t('design.noSearchResults')}</p><button className="text-button" onClick={() => { setSearch(''); setCategoryFilter('all') }}>{t('design.clearSearch')}</button></div> : (
        <VocabularyBookGrid
          groupedBooks={groupedBooks}
          orderedCategories={orderedCategories}
          getCategoryLabel={getCategoryLabel}
          isManaging={isManaging}
          selectedBooks={selectedBooks}
          onToggleSelection={toggleSelection}
        />
      )}
      </div>

      {/* Edit Category Modal */}
      {showEditCategoryModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 dialog-overlay" onClick={() => setShowEditCategoryModal(false)} />
          <div
            className="relative w-full max-w-md rounded-2xl border border-border/50 bg-background p-6 shadow-2xl"
          >
            <button
              onClick={() => setShowEditCategoryModal(false)}
              className="glass-control absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-lg font-semibold">{t('vocabulary.editCategory', 'Edit Category')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('vocabulary.selectedBooks', { count: selectedBooks.size })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">{t('vocabulary.selectCategory')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setEditCategory(cat)}
                      className={cn('glass-primary',
                        'rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        editCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowEditCategoryModal(false)}
                  className="glass-control rounded-lg border px-4 py-2 text-sm font-medium "
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleBulkUpdateCategory}
                  className="glass-primary rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Categories Modal */}
      <Dialog open={showManageCategoriesModal} onOpenChange={setShowManageCategoriesModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t('vocabulary.manageCategories')}</DialogTitle>
          <DialogDescription>{t('vocabulary.reorderCategories')}</DialogDescription>
          <div className="flex gap-2">
            <input
              type="text"
              aria-label={t('vocabulary.newCategoryPlaceholder')}
              value={newCategoryInput}
              disabled={savingOrder}
              onChange={(event) => setNewCategoryInput(event.target.value)}
              placeholder={t('vocabulary.newCategoryPlaceholder')}
              className="glass-field min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
              onKeyDown={(event) => event.key === 'Enter' && void handleAddCategory()}
            />
            <button
              onClick={handleAddCategory}
              disabled={savingOrder || !newCategoryInput.trim() || allCategories.includes(newCategoryInput.trim())}
              className="primary-button"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('common.add')}
            </button>
          </div>
          <ol className="max-h-[min(360px,50vh)] space-y-2 overflow-y-auto thin-scrollbar" aria-busy={savingOrder}>
            {allCategories.map((cat, index) => (
              <li
                key={cat}
                className={cn('category-sort-row', dropCategory === cat && 'is-drop-target', draggedCategory === cat && 'is-dragging')}
                onDragOver={(event) => {
                  if (!draggedCategory || savingOrder) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropCategory(cat)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggedCategory) void moveCategory(draggedCategory, cat)
                  setDraggedCategory(null)
                  setDropCategory(null)
                }}
              >
                <button
                  type="button"
                  draggable={!savingOrder}
                  aria-disabled={savingOrder}
                  className="category-drag-handle"
                  aria-label={t('vocabulary.moveCategory', { category: cat })}
                  title={t('vocabulary.moveCategory', { category: cat })}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', cat)
                    setDraggedCategory(cat)
                  }}
                  onDragEnd={() => { setDraggedCategory(null); setDropCategory(null) }}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                    event.preventDefault()
                    const target = allCategories[index + (event.key === 'ArrowUp' ? -1 : 1)]
                    if (target) void moveCategory(cat, target)
                  }}
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{cat}</span>
                {DEFAULT_CATEGORIES.includes(cat) && <span className="quiet-badge">{t('common.default')}</span>}
                <button className="category-move-button" disabled={savingOrder || index === 0} aria-label={t('vocabulary.moveCategoryUp', { category: cat })} onClick={() => void moveCategory(cat, allCategories[index - 1])}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button className="category-move-button" disabled={savingOrder || index === allCategories.length - 1} aria-label={t('vocabulary.moveCategoryDown', { category: cat })} onClick={() => void moveCategory(cat, allCategories[index + 1])}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  className="category-move-button hover:text-destructive"
                  disabled={savingOrder || DEFAULT_CATEGORIES.includes(cat)}
                  aria-label={t('vocabulary.deleteCategory', { category: cat })}
                  onClick={() => void handleDeleteCategory(cat)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 dialog-overlay" onClick={() => setShowDeleteConfirmModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border/50 bg-background p-6 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <Trash2 className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t('vocabulary.deleteBook')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('vocabulary.deleteBooksConfirm', { count: selectedBooks.size })}
              </p>

              <div className="mt-6 flex w-full gap-3">
                <button
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="glass-control flex-1 rounded-lg border px-4 py-2 text-sm font-medium "
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive-hover"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
