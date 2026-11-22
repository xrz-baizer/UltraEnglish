import { useEffect, useState } from 'react'
import { FileAudio, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import type { GeneratedAudio } from '../../shared/audio-generation'

interface AudioGenerationHistoryProps {
  onClose: () => void
  onOpen: (record: GeneratedAudio) => void
}

export function AudioGenerationHistory({ onClose, onOpen }: AudioGenerationHistoryProps) {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<GeneratedAudio[]>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setData(undefined)
    setFailed(false)
    void window.electronAPI.getAudioGenerationHistory().then((result) => {
      if (active) setData(result)
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => { active = false }
  }, [attempt])

  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const duration = new Intl.NumberFormat(i18n.language, {
    style: 'unit', unit: 'second', maximumFractionDigits: 1
  })
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="audio-generation-history-dialog" aria-describedby={undefined} hideCloseButton>
        <DialogTitle>{t('audioGeneration.history.title')}</DialogTitle>
        <div className="audio-generation-history-scroll thin-scrollbar">
          {failed ? (
            <div className="inline-error" role="alert">
              {t('audioGeneration.history.loadFailed')}
              <button type="button" className="text-button" onClick={() => setAttempt((current) => current + 1)}>
                <RotateCcw size={14} aria-hidden="true" />
                {t('common.retry')}
              </button>
            </div>
          ) : !data ? (
            <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : data.length > 0 && (
            <ul className="audio-generation-history-list">
              {data.map((record) => (
                <li key={record.id} className="audio-generation-history-row">
                  <div className="audio-generation-file-summary">
                    <FileAudio size={20} className="shrink-0 text-primary-ink" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="audio-generation-history-name">{record.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <time dateTime={record.createdAt}>{date.format(new Date(record.createdAt))}</time>
                        {' · '}{record.options.format.toUpperCase()}{' · '}{duration.format(record.duration)}
                      </p>
                    </div>
                  </div>
                  <div className="audio-generation-actions">
                    {record.importedId && (
                      <Link className="text-button" to={`/audios/${record.importedId}`}>
                        {t('audioGeneration.result.open')}
                      </Link>
                    )}
                    <button type="button" className="secondary-button" onClick={() => onOpen(record)}>
                      {t('audioGeneration.history.view')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end">
          <button type="button" className="secondary-button" onClick={onClose}>{t('common.close')}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
