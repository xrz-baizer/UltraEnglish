import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ActionTooltip } from '@renderer/components/ui/action-tooltip'
import { useSettingsStore } from '@renderer/stores/settings-store'

type Model = Awaited<
  ReturnType<typeof window.electronAPI.getDownloadedModels>
>[number]
export function TranscriptionModelDialog({
  replacing,
  onClose,
  onConfirm
}: {
  replacing: boolean
  onClose: () => void
  onConfirm: (modelId: string) => void
}) {
  const { t } = useTranslation()
  const preferred = useSettingsStore((state) => state.settings.audio.sttModelId)
  const [models, setModels] = useState<Model[]>([])
  const [selected, setSelected] = useState(preferred || 'tiny')
  const [loading, setLoading] = useState(true)
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const mounted = useRef(true)
  const picker = useRef<HTMLDetailsElement>(null)
  const load = async () => {
    const list = await window.electronAPI.getDownloadedModels()
    if (mounted.current) setModels(list)
  }
  useEffect(() => {
    mounted.current = true
    void load()
      .catch(() => toast.error(t('settings.audio.loadFailed')))
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
    const unsubscribe = window.electronAPI.on(
      'stt-model-download-progress',
      (value) => {
        const { modelId, percent } = value as {
          modelId: string
          percent: number
        }
        setDownloads((current) => ({ ...current, [modelId]: percent }))
      }
    )
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [t])
  const download = async (id: string) => {
    setDownloads((current) => ({ ...current, [id]: 0 }))
    try {
      if (!(await window.electronAPI.downloadSttModel(id)))
        throw new Error('Download failed')
      await load()
    } catch {
      toast.error(t('settings.audio.downloadFailed'))
    } finally {
      if (mounted.current)
        setDownloads((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
    }
  }
  const model = models.find((item) => item.id === selected)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{t('audio.chooseTranscriptionModel')}</DialogTitle>
        <details className="transcription-model-picker" ref={picker}>
          <summary
            className="flex cursor-pointer items-center justify-between rounded-lg border p-3"
            aria-label={t('audio.transcriptionModel')}
          >
            {loading
              ? t('common.loading')
              : `Whisper ${model?.name || selected}`}
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div
            className="mt-2 space-y-1 rounded-lg border p-2"
            role="listbox"
            aria-label={t('audio.transcriptionModel')}
          >
            {models.map((item) => (
              <div className="flex items-center gap-2" key={item.id}>
                <button
                  className="glass-control flex min-w-0 flex-1 items-center justify-between rounded-lg p-2 text-left "
                  role="option"
                  aria-selected={selected === item.id}
                  onClick={() => {
                    setSelected(item.id)
                    if (picker.current) picker.current.open = false
                  }}
                >
                  <span>
                    Whisper {item.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.size}
                    </span>
                  </span>
                  {selected === item.id && (
                    <Check className="h-4 w-4 text-primary-ink" />
                  )}
                </button>
                {item.downloaded ? (
                  <Check
                    className="m-2 h-4 w-4 text-primary-ink"
                    aria-label={t('common.downloaded')}
                  />
                ) : (
                  <ActionTooltip
                    label={t('audio.downloadModel', { name: item.name })}
                    showWhenDisabled
                  >
                    <button
                      className="icon-button"
                      disabled={downloads[item.id] !== undefined}
                      aria-label={t('audio.downloadModel', { name: item.name })}
                      onClick={() => void download(item.id)}
                    >
                      {downloads[item.id] !== undefined ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </ActionTooltip>
                )}
                {downloads[item.id] !== undefined && (
                  <span className="text-xs tabular-nums">
                    {downloads[item.id]}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
        {model && !model.downloaded && (
          <p className="text-sm text-muted-foreground">
            {t('audio.modelDownloadRequired')}
          </p>
        )}
        {replacing && <p className="text-sm">{t('audio.regenerateWarning')}</p>}
        <div className="flex justify-end gap-2">
          <button className="secondary-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="primary-button"
            disabled={loading || !model?.downloaded}
            onClick={() => onConfirm(selected)}
          >
            {t(replacing ? 'audio.regenerateSubtitles' : 'audio.generateSubtitles')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
