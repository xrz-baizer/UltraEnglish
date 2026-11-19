import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { TranscriptionSegment } from '../../../shared/audio-transcription'

interface Props {
  segments: TranscriptionSegment[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (segments: TranscriptionSegment[]) => Promise<void>
  onRegenerate: () => void
  onImport: () => void
  onPasteText: (text: string) => void
}
export function SubtitlesManager({
  segments,
  busy,
  error,
  onClose,
  onSave,
  onRegenerate,
  onImport,
  onPasteText
}: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(segments)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [confirmPaste, setConfirmPaste] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discard, setDiscard] = useState(false)
  const rowsDirty = draft.some((segment,index)=>segment.text!==segments[index]?.text)
  const dirty = !!pasteText.trim() || rowsDirty
  const close = () => {
    if (busy || saving) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } catch {
      toast.error(t('audio.subtitleSaveFailed'))
    } finally {
      setSaving(false)
    }
  }
  const time = (value: number) =>
    `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, '0')}`
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent
          className="subtitles-manager"
          aria-describedby={undefined}
        >
          <DialogTitle>{t('audio.manageSubtitles')}</DialogTitle>
          <div className="flex flex-wrap gap-2">
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={() => setShowPaste((value) => !value)}
            >
              {t(
                showPaste
                  ? 'audio.backToSubtitleRows'
                  : 'audio.pasteTextSubtitles'
              )}
            </button>
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={onImport}
            >
              {t('audio.uploadSubtitles')}
            </button>
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={onRegenerate}
            >
              {t('audio.regenerateSubtitles')}
            </button>
          </div>
          {busy && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('audio.processingSubtitles')}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {showPaste ? (
            <div className="subtitle-paste-editor">
              <textarea
                className="glass-field rounded-lg border p-3"
                aria-label={t('audio.completeSubtitleText')}
                placeholder={t('audio.pasteSubtitlePlaceholder')}
                value={pasteText}
                maxLength={200000}
                disabled={busy || saving}
                onChange={(event) => setPasteText(event.target.value)}
              />
            </div>
          ) : (
            <div className="subtitle-editor-list">
              {draft.length ? (
                draft.map((segment, index) => (
                  <label key={segment.id} className="subtitle-editor-row">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {index + 1} · {time(segment.startTime)} –{' '}
                      {time(segment.endTime)}
                    </span>
                    <textarea
                      aria-label={t('audio.subtitleRow', { number: index + 1 })}
                      disabled={busy || saving}
                      className="glass-field rounded-lg border p-3"
                      value={segment.text}
                      onChange={(event) =>
                        setDraft((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, text: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                ))
              ) : (
                <p className="p-4 text-muted-foreground">
                  {t('audio.noSubtitles')}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={close}
            >
              {t('common.cancel')}
            </button>
            {showPaste ? (
              <button
                className="primary-button"
                disabled={busy || saving || !pasteText.trim()}
                onClick={() => setConfirmPaste(true)}
              >
                {t('audio.alignPastedSubtitles')}
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={
                  busy ||
                  saving ||
                  !rowsDirty ||
                  draft.some((segment) => !segment.text.trim())
                }
                onClick={() => void save()}
              >
                {t('audio.saveAllSubtitles')}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmPaste} onOpenChange={setConfirmPaste}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{t('audio.confirmPasteSubtitles')}</DialogTitle>
          <p className="text-sm">{t('audio.importSubtitlesWarning')}</p>
          <div className="flex justify-end gap-2">
            <button
              className="secondary-button"
              onClick={() => setConfirmPaste(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setConfirmPaste(false)
                onPasteText(pasteText)
              }}
            >
              {t('audio.alignPastedSubtitles')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{t('audio.discardSubtitleChanges')}</DialogTitle>
          <div className="flex justify-end gap-2">
            <button
              className="secondary-button"
              onClick={() => setDiscard(false)}
            >
              {t('common.cancel')}
            </button>
            <button className="primary-button" onClick={onClose}>
              {t('common.confirm')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
