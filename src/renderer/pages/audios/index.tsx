import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Trash2,
  FolderOpen,
  FolderEdit,
  Plus,
  Search,
  Headphones,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@renderer/lib/utils'
import { Select } from '@renderer/components/ui/select'
import { AudioResourceDialog } from './audio-resource-dialog'

interface Audio {
  id: string
  name: string
  category: string | null
  description: string | null
  duration: number | null
  filePath: string
  hasTranscription: boolean
  createdAt: string
}

type SortField = 'name' | 'duration' | 'createdAt'
type SortOrder = 'asc' | 'desc'
export function AudiosPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [audios, setAudios] = useState<Audio[]>([])
  const [loading, setLoading] = useState(true)
  const [resourceDialog, setResourceDialog] = useState<'add' | 'transcribe' | Audio | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const resourceTrigger = useRef<HTMLButtonElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const tableViewport = useRef<HTMLDivElement>(null)
  const [categoryTargets, setCategoryTargets] = useState<string[]>([])
  const [categoryDraft, setCategoryDraft] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const editCategory = (ids: string[]) => {
    setCategoryDraft(
      ids.length === 1
        ? audios.find((audio) => audio.id === ids[0])?.category || ''
        : ''
    )
    setCategoryTargets(ids)
  }
  const saveCategory = async () => {
    setSavingCategory(true)
    try {
      await window.electronAPI.updateAudioCategory(
        categoryTargets,
        categoryDraft
      )
      await loadAudios()
      setCategoryTargets([])
      setSelectedCategory('')
      setPage(1)
      setSelectedIds(new Set())
    } catch {
      toast.error(t('audio.categorySaveFailed'))
    } finally {
      setSavingCategory(false)
    }
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [page, setPage] = useState(1)
  const [pageCapacity, setPageCapacity] = useState({ withPagination: 1, withoutPagination: 1 })
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isManaging, setIsManaging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (searchParams.get('action') !== 'transcribe') return
    resourceTrigger.current = null
    setResourceDialog('transcribe')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('action')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  // Categories persist independently of audio rows.
  const [categoryRecords, setCategoryRecords] = useState<
    { id: string; name: string }[]
  >([])
  const categories = categoryRecords.map((category) => category.name)
  const [managingCategories, setManagingCategories] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const categoryAction = async (action: () => Promise<unknown>) => {
    setCategoryBusy(true)
    try {
      await action()
      await loadAudios()
      setNewCategory('')
      setRenaming(null)
    } catch {
      toast.error(t('audio.categorySaveFailed'))
    } finally {
      setCategoryBusy(false)
    }
  }

  // Filter and sort audios
  const filteredAudios = useMemo(() => {
    let result = [...audios]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.category?.toLowerCase().includes(query)
      )
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((a) => a.category === selectedCategory)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'duration':
          cmp = (a.duration || 0) - (b.duration || 0)
          break
        case 'createdAt':
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [audios, searchQuery, selectedCategory, sortField, sortOrder])

  const hasRows = filteredAudios.length > 0
  const showPagination = filteredAudios.length > pageCapacity.withoutPagination
  const pageSize = showPagination ? pageCapacity.withPagination : pageCapacity.withoutPagination
  const pageCount = Math.max(1, Math.ceil(filteredAudios.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleAudios = useMemo(
    () => filteredAudios.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredAudios, currentPage, pageSize]
  )
  const allVisibleSelected = visibleAudios.length > 0 &&
    visibleAudios.every((audio) => selectedIds.has(audio.id))

  useEffect(() => {
    setPage((previous) => Math.min(previous, pageCount))
  }, [pageCount])

  useEffect(() => {
    setSelectedIds((selected) => {
      const visibleSelection = visibleAudios
        .filter((audio) => selected.has(audio.id))
        .map((audio) => audio.id)
      return visibleSelection.length === selected.size ? selected : new Set(visibleSelection)
    })
  }, [visibleAudios])

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    const filters = toolbar?.firstElementChild
    const viewport = tableViewport.current
    const header = viewport?.querySelector('thead')
    const body = viewport?.querySelector('tbody')
    if (!toolbar || !filters || !viewport || !header || !body) return

    const measure = () => {
      const rowHeight = body.rows[0]?.getBoundingClientRect().height
      if (!rowHeight || !viewport.clientHeight) return
      const availableHeight = viewport.clientHeight - header.getBoundingClientRect().height
      // When pagination wraps below the filters, exclude that extra height from the overflow decision.
      const pagerHeight = Math.max(0, toolbar.getBoundingClientRect().height - filters.getBoundingClientRect().height)
      const withPagination = Math.max(1, Math.floor(availableHeight / rowHeight))
      const withoutPagination = Math.max(1, Math.floor((availableHeight + pagerHeight) / rowHeight))
      setPageCapacity((previous) =>
        previous.withPagination === withPagination && previous.withoutPagination === withoutPagination
          ? previous
          : { withPagination, withoutPagination }
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    for (const element of [toolbar, filters, viewport, header, body]) {
      observer.observe(element)
    }
    return () => observer.disconnect()
  }, [hasRows, showPagination, isManaging])

  useEffect(() => {
    loadAudios()
  }, [])

  const loadAudios = async () => {
    try {
      const [result, storedCategories] = await Promise.all([
        window.electronAPI.getAudios(),
        window.electronAPI.getAudioCategories()
      ])
      setCategoryRecords(storedCategories)
      setSelectedCategory((category) =>
        storedCategories.some((record) => record.name === category) ? category : ''
      )
      // Transform to include additional fields
      const audiosWithMeta = (result as Audio[]).map((a) => ({
        ...a,
        category: a.category || null,
        description: a.description || null
      }))
      setAudios(audiosWithMeta)
    } catch (error) {
      console.error('Failed to load audios:', error)
    } finally {
      setLoading(false)
    }
  }

  const openStorageFolder = async () => {
    try {
      const error = await window.electronAPI.openAudioStorageFolder()
      if (error) toast.error(t('audio.openStorageFailed'))
    } catch {
      toast.error(t('audio.openStorageFailed'))
    }
  }

  const showResourceDialog = (target: 'add' | Audio, trigger: HTMLButtonElement) => {
    resourceTrigger.current = trigger
    setResourceDialog(target)
  }

  const changePage = (next: number) => {
    setPage(next)
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (!isManaging || deleting || !selectedIds.size) return
    if (!confirm(t('audio.batchDeleteConfirm', { count: selectedIds.size }))) return

    setDeleting(true)
    const removed = new Set<string>()
    try {
      for (const id of selectedIds) {
        await window.electronAPI.deleteAudio(id)
        removed.add(id)
      }
    } catch (error) {
      console.error('Failed to batch delete audios:', error)
      toast.error(t('audio.batchDeleteFailed'))
    } finally {
      setAudios((current) => current.filter((audio) => !removed.has(audio.id)))
      setSelectedIds((current) => new Set([...current].filter((id) => !removed.has(id))))
      setDeleting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(new Set(allVisibleSelected ? [] : visibleAudios.map((audio) => audio.id)))
  }

  const toggleSort = (field: SortField) => {
    changePage(1)
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="content-container audio-page">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-9 w-24 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="flex-1 overflow-hidden rounded-xl border border-border/50">
          <div className="h-12 animate-pulse bg-muted/50" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-t border-border/50 bg-card/50"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="content-container audio-page">
      {resourceDialog && (
        <AudioResourceDialog
          audio={typeof resourceDialog === 'string' ? undefined : resourceDialog}
          initialCategory={typeof resourceDialog === 'string' ? selectedCategory : resourceDialog.category || ''}
          categories={categories}
          onClose={() => setResourceDialog(null)}
          onSaved={(audioId) => {
            if (resourceDialog === 'transcribe') {
              navigate(`/audios/${audioId}`, { replace: true })
              return
            }
            if (resourceDialog === 'add') {
              setSearchQuery('')
              setSelectedCategory('')
              changePage(1)
            } else {
              setSelectedIds(new Set())
            }
            setResourceDialog(null)
            void loadAudios()
          }}
          restoreFocus={() => {
            const trigger = resourceTrigger.current
            if (trigger?.isConnected) trigger.focus()
            else addButton.current?.focus()
          }}
        />
      )}
      <Dialog
        open={managingCategories}
        onOpenChange={(open) => {
          if (!categoryBusy) setManagingCategories(open)
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{t('audio.manageCategories')}</DialogTitle>
          <div className="flex gap-2">
            <input
              className="glass-field min-w-0 flex-1 rounded-lg border p-2"
              aria-label={t('audio.newCategory')}
              maxLength={80}
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={categoryBusy || !newCategory.trim()}
              onClick={() =>
                void categoryAction(() =>
                  window.electronAPI.createAudioCategory(newCategory)
                )
              }
            >
              {t('audio.addCategory')}
            </button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {categoryRecords.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                {renaming === category.id ? (
                  <>
                    <input
                      className="glass-field min-w-0 flex-1 rounded border p-2"
                      aria-label={t('audio.category')}
                      maxLength={80}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                    />
                    <button
                      className="secondary-button"
                      disabled={categoryBusy || !renameDraft.trim()}
                      onClick={() =>
                        void categoryAction(() =>
                          window.electronAPI.renameAudioCategory(
                            category.id,
                            renameDraft
                          )
                        )
                      }
                    >
                      {t('common.save')}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={categoryBusy}
                      onClick={() => setRenaming(null)}
                    >
                      {t('common.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 break-words">
                      {category.name}
                    </span>
                    <button
                      className="secondary-button"
                      disabled={categoryBusy}
                      onClick={() => {
                        setRenaming(category.id)
                        setRenameDraft(category.name)
                      }}
                    >
                      {t('audio.renameCategory')}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={categoryBusy}
                      onClick={() =>
                        void categoryAction(() =>
                          window.electronAPI.deleteAudioCategory(category.id)
                        )
                      }
                    >
                      {t('common.delete')}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('audio.deleteCategoryHint')}
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={categoryTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !savingCategory) setCategoryTargets([])
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{t('audio.editCategory')}</DialogTitle>
          <Select
            label={t('audio.category')}
            value={categoryDraft}
            onValueChange={setCategoryDraft}
            disabled={savingCategory}
            options={[{ value: '', label: t('audio.uncategorized') }, ...categories.map(category => ({ value: category, label: category }))]}
          />
          <div className="flex justify-end gap-2">
            <button
              className="secondary-button"
              disabled={savingCategory}
              onClick={() => setCategoryTargets([])}
            >
              {t('common.cancel')}
            </button>
            <button
              className="primary-button"
              disabled={savingCategory}
              onClick={() => void saveCategory()}
            >
              {t('common.save')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="library-heading">
        <div className="page-heading">
          <h1>{t('shell.audios')}</h1>
          <div className="library-meta">
            <span>{t('design.audioCount', { count: audios.length })}</span>
          </div>
        </div>

        {/* Library actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!isManaging && (
            <button className="secondary-button" onClick={() => setManagingCategories(true)}>
              <FolderEdit className="h-4 w-4" aria-hidden="true" />
              {t('audio.manageCategories')}
            </button>
          )}
          <button
            className={isManaging ? 'primary-button' : 'secondary-button'}
            disabled={deleting || (!isManaging && !hasRows)}
            onClick={() => {
              setSelectedIds(new Set())
              setIsManaging(!isManaging)
            }}
          >
            {!isManaging && <Settings2 className="h-4 w-4" aria-hidden="true" />}
            {t(isManaging ? 'common.done' : 'common.manage')}
          </button>
          {isManaging ? (
            selectedIds.size > 0 && (
              <>
                <button className="secondary-button" disabled={deleting}
                  onClick={() => editCategory(Array.from(selectedIds))}>
                  <FolderEdit className="h-4 w-4" aria-hidden="true" />
                  {t('audio.editCategory')}
                </button>
                <button onClick={() => void handleBatchDelete()} disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t('common.delete')} ({selectedIds.size})
                </button>
              </>
            )
          ) : (
            <>
              <button onClick={openStorageFolder} className="secondary-button">
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                {t('audio.openStorageFolder')}
              </button>
              <button ref={addButton} onClick={(event) => showResourceDialog('add', event.currentTarget)}
                className="primary-button">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('audio.addResource')}
              </button>
            </>
          )}
        </div>
      </div>
      <div ref={toolbarRef} className="audio-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('design.searchAudio')}
              aria-label={t('design.searchAudio')}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                changePage(1)
              }}
              className="glass-field h-9 w-48 rounded-lg border pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          {/* Category filter */}
          <Select
            label={t('design.filterCategory')}
            value={selectedCategory}
            onValueChange={(category) => {
              setSelectedCategory(category)
              changePage(1)
            }}
            options={[{ value: '', label: t('audio.allCategories') }, ...categories.map(category => ({ value: category, label: category }))]}
          />

          {/* Sort */}
          <Select
            label={t('design.sortAudio')}
            value={`${sortField}-${sortOrder}`}
            onValueChange={value => {
              const [field, order] = value.split('-')
              setSortField(field as SortField)
              setSortOrder(order as SortOrder)
              changePage(1)
            }}
            options={[
              { value: 'name-asc', label: t('audio.sortNameAsc') },
              { value: 'name-desc', label: t('audio.sortNameDesc') },
              { value: 'createdAt-desc', label: t('audio.sortNewest') },
              { value: 'createdAt-asc', label: t('audio.sortOldest') },
              { value: 'duration-desc', label: t('audio.sortLongest') },
              { value: 'duration-asc', label: t('audio.sortShortest') }
            ]}
          />
        </div>
        {showPagination && (
          <nav className="audio-pagination" aria-label={t('audio.pagination')}>
            <button
              className="secondary-button"
              disabled={currentPage <= 1}
              onClick={() => changePage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('audio.previousPage')}
            </button>
            <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
              {t('audio.pageNumber', { page: currentPage, total: pageCount })}
            </span>
            <button
              className={currentPage < pageCount ? 'primary-button' : 'secondary-button'}
              disabled={currentPage >= pageCount}
              onClick={() => changePage(currentPage + 1)}
            >
              {t('audio.nextPage')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>

      {/* Table */}
      {!hasRows ? (
        /* Empty state */
        <div className="surface-panel library-empty flex-1">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center text-muted-foreground">
              <Headphones className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              {t('audio.noAudios')}
            </h3>

            <button
              onClick={(event) => showResourceDialog('add', event.currentTarget)}
              className="primary-button mt-8"
            >
              <Plus className="h-4 w-4" />
              {t('audio.importAudio')}
            </button>
          </div>
        </div>
      ) : (
        <div className="surface-panel audio-table">
          <div ref={tableViewport} className="h-full overflow-x-auto overflow-y-hidden thin-scrollbar">
            <table className="w-full min-w-[600px] table-fixed whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {isManaging && (
                    <th className="w-[60px] p-3">
                      <input
                        type="checkbox"
                        aria-label={t('design.selectAllAudio')}
                        checked={allVisibleSelected}
                        disabled={deleting}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-input"
                      />
                    </th>
                  )}
                  <th className="p-3 text-left">
                    <button
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t('audio.columnName')}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="w-[22%] p-3 text-left text-sm font-medium text-muted-foreground">
                    {t('audio.columnCategory')}
                  </th>
                  <th className="w-[10rem] p-3 text-left">
                    <button
                      onClick={() => toggleSort('createdAt')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t('audio.columnCreatedAt')}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="w-[112px] p-3 text-left text-sm font-medium text-muted-foreground">
                    {t('audio.columnActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleAudios.map((audio) => (
                  <tr
                    key={audio.id}
                    className={cn(
                      'group border-b border-border/30 transition-colors hover:bg-muted/30',
                      selectedIds.has(audio.id) && 'bg-primary/5'
                    )}
                  >
                    {isManaging && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`${t('design.selectAudio')}: ${audio.name}`}
                          checked={selectedIds.has(audio.id)}
                          disabled={deleting}
                          onChange={() => toggleSelect(audio.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                    )}
                    <td className="p-3">
                      <NavLink
                        to={`/audios/${audio.id}`}
                        title={audio.name}
                        className="block truncate font-medium text-foreground hover:text-primary-ink hover:underline"
                      >
                        {audio.name}
                      </NavLink>
                    </td>
                    <td className="truncate p-3 text-sm text-muted-foreground" title={audio.category || undefined}>
                      {audio.category || '-'}
                    </td>
                    <td className="truncate p-3 text-sm text-muted-foreground tabular-nums">
                      {formatDate(audio.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="audio-category-action secondary-button"
                          aria-label={`${t('audio.editResource')}: ${audio.name}`}
                          title={t('audio.editResource')}
                          onClick={(event) => showResourceDialog(audio, event.currentTarget)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
