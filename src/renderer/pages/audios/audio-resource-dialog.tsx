import { useRef, useState } from 'react'
import { FileAudio, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Select } from '@renderer/components/ui/select'
import { MAX_AUDIO_NAME_LENGTH } from '../../../shared/audio-library'
import type { SelectedAudioFile } from '../../../shared/audio-library'

interface Props {
  audio?: { id: string; name: string; category: string | null }
  initialCategory: string
  categories: string[]
  onClose: () => void
  onSaved: (audioId: string) => void
  restoreFocus: () => void
}

export function AudioResourceDialog({
  audio,
  initialCategory,
  categories,
  onClose,
  onSaved,
  restoreFocus
}: Props) {
  const { t } = useTranslation()
  const [file, setFile] = useState<SelectedAudioFile | null>(null)
  const [name, setName] = useState(audio?.name ?? '')
  const [category, setCategory] = useState(initialCategory)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const busy = picking || saving
  const canSave = !busy && (audio ? !!name.trim() : !!file)

  const selectFile = async () => {
    setPicking(true)
    setError('')
    try {
      const selected = await window.electronAPI.selectAudioFile()
      if (selected) {
        setFile(selected)
        nameInput.current?.focus()
      }
    } catch {
      setError(t('audio.selectAudioFailed'))
    } finally {
      setPicking(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const details = { name, category }
      if (audio) {
        await window.electronAPI.updateAudioDetails(audio.id, details)
        onSaved(audio.id)
      } else if (file) {
        const id = await window.electronAPI.importAudio(file.token, details)
        onSaved(id)
      }
    } catch {
      setError(t(audio ? 'audio.saveAudioFailed' : 'audio.importAudioFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <DialogTitle>{t(audio ? 'audio.editResource' : 'audio.addResource')}</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {!audio && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t('audio.audioFile')}</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void selectFile()}
                >
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  {t(file ? 'audio.changeAudioFile' : 'audio.chooseAudioFile')}
                </button>
                {file && (
                  <span className="flex min-w-0 items-center gap-2 text-sm" title={file.fileName}>
                    <FileAudio className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{file.fileName}</span>
                  </span>
                )}
              </div>
            </div>
          )}
          <label className="grid gap-2 text-sm font-medium">
            {t('audio.columnName')}
            <input
              ref={nameInput}
              className="glass-field min-w-0 rounded-lg border px-3 py-2 font-normal"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={file?.defaultName}
              maxLength={MAX_AUDIO_NAME_LENGTH}
              readOnly={saving}
            />
            {!audio && (
              <span className="text-xs font-normal text-muted-foreground">{t('audio.defaultAudioNameHint')}</span>
            )}
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t('audio.category')}</span>
            <Select
              label={t('audio.category')}
              value={category}
              onValueChange={setCategory}
              disabled={busy}
              options={[
                { value: '', label: t('audio.uncategorized') },
                ...categories.map((name) => ({ value: name, label: name }))
              ]}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="primary-button" type="submit" disabled={!canSave}>
              {t(saving ? 'common.loading' : audio ? 'common.save' : 'audio.confirmAddResource')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
