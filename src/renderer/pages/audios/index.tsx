import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useEffect, useState, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Trash2,
  FolderOpen,
  FolderEdit,
  Plus,
  Search,
  Headphones,
  ArrowUpDown
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@renderer/lib/utils'
import { Select } from '@renderer/components/ui/select'

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
  const [audios, setAudios] = useState<Audio[]>([])
  const [loading, setLoading] = useState(true)
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
      setSelectedCategory('all')
      setSelectedIds(new Set())
    } catch {
      toast.error(t('audio.categorySaveFailed'))
    } finally {
      setSavingCategory(false)
    }
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    if (selectedCategory !== 'all') {
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

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importAudio()
      if (result) {
        loadAudios()
      }
    } catch (error) {
      console.error('Failed to import audio:', error)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(t('audio.deleteConfirm'))) return

    try {
      await window.electronAPI.deleteAudio(id)
      setAudios(audios.filter((a) => a.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (error) {
      console.error('Failed to delete audio:', error)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(t('audio.batchDeleteConfirm', { count: selectedIds.size })))
      return

    try {
      for (const id of selectedIds) {
        await window.electronAPI.deleteAudio(id)
      }
      setAudios(audios.filter((a) => !selectedIds.has(a.id)))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Failed to batch delete audios:', error)
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
    if (selectedIds.size === filteredAudios.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAudios.map((a) => a.id)))
    }
  }

  const toggleSort = (field: SortField) => {
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
          <button
            className="secondary-button"
            onClick={() => setManagingCategories(true)}
          >
            <FolderEdit className="h-4 w-4" />
            {t('audio.manageCategories')}
          </button>
          <button
            className="secondary-button"
            style={{ display: selectedIds.size ? 'inline-flex' : 'none' }}
            disabled={!selectedIds.size}
            onClick={() => editCategory(Array.from(selectedIds))}
          >
            <FolderEdit className="h-4 w-4" />
            {t('audio.editCategory')}
          </button>
          <button onClick={openStorageFolder} className="secondary-button">
            <FolderOpen className="h-4 w-4" />
            {t('audio.openStorageFolder')}
          </button>
          <button onClick={handleImport} className="secondary-button">
            <Plus className="h-4 w-4" />
            {t('audio.addResource')}
          </button>

          <button
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              selectedIds.size > 0
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive-hover'
                : 'border border-border bg-background text-muted-foreground opacity-50 cursor-not-allowed'
            )}
          >
            <Trash2 className="h-4 w-4" />
            {t('audio.batchDelete')}
          </button>
        </div>
      </div>
      <div className="audio-toolbar">
        {/* Right filters */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('design.searchAudio')}
              aria-label={t('design.searchAudio')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-field h-9 w-48 rounded-lg border pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          {/* Category filter */}
          <Select
            label={t('design.filterCategory')}
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            options={[{ value: 'all', label: t('audio.allCategories') }, ...categories.map(category => ({ value: category, label: category }))]}
          />

          {/* Sort */}
          <Select
            label={t('design.sortAudio')}
            value={`${sortField}-${sortOrder}`}
            onValueChange={value => {
              const [field, order] = value.split('-')
              setSortField(field as SortField)
              setSortOrder(order as SortOrder)
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
      </div>

      {/* Table */}
      {filteredAudios.length === 0 ? (
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
              onClick={handleImport}
              className="glass-primary mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
            >
              <Plus className="h-4 w-4" />
              {t('audio.importAudio')}
            </button>
          </div>
        </div>
      ) : (
        <div className="surface-panel audio-table">
          <div className="overflow-auto h-full thin-scrollbar">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      aria-label={t('design.selectAllAudio')}
                      checked={
                        selectedIds.size === filteredAudios.length &&
                        filteredAudios.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-input"
                    />
                  </th>
                  <th className="p-3 text-left">
                    <button
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t('audio.columnName')}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    {t('audio.columnCategory')}
                  </th>
                  <th className="p-3 text-left">
                    <button
                      onClick={() => toggleSort('createdAt')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t('audio.columnCreatedAt')}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    {t('audio.columnActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAudios.map((audio) => (
                  <tr
                    key={audio.id}
                    className={cn(
                      'group border-b border-border/30 transition-colors hover:bg-muted/30',
                      selectedIds.has(audio.id) && 'bg-primary/5'
                    )}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`${t('design.selectAudio')}: ${audio.name}`}
                        checked={selectedIds.has(audio.id)}
                        onChange={() => toggleSelect(audio.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                    </td>
                    <td className="p-3">
                      <NavLink
                        to={`/audios/${audio.id}`}
                        className="font-medium text-foreground hover:text-primary-ink hover:underline"
                      >
                        {audio.name}
                      </NavLink>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {audio.category || '-'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground tabular-nums">
                      {formatDate(audio.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="audio-category-action secondary-button"
                          aria-label={`${t('audio.editCategory')}: ${audio.name}`}
                          title={t('audio.editCategory')}
                          onClick={() => editCategory([audio.id])}
                        >
                          <FolderEdit className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`${t('common.delete')}: ${audio.name}`}
                          onClick={(e) => handleDelete(audio.id, e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
