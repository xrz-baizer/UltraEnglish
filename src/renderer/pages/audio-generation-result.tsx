import { useEffect, useState } from 'react'
import { Check, FileAudio, FolderOpen, LibraryBig, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@renderer/components/ui/dialog'
import type { GeneratedAudio } from '../../shared/audio-generation'

interface AudioGenerationResultProps {
  result: GeneratedAudio
  onClose: (restoreFocus?: boolean) => void
}

export function AudioGenerationResult({ result, onClose }: AudioGenerationResultProps) {
  const { t, i18n } = useTranslation()
  const [importedId, setImportedId] = useState(result.importedId)
  const { format, speed, voice } = result.options
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [operation, setOperation] = useState<'reveal' | 'import'>()
  const [error, setError] = useState<'reveal' | 'import'>()

  useEffect(() => {
    let active = true
    let url: string | undefined
    void window.electronAPI.previewGeneratedAudio(result.id).then((bytes) => {
      if (!active) return
      url = URL.createObjectURL(new Blob([bytes], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' }))
      setPreviewUrl(url)
    }).catch(() => {
      if (active) setPreviewFailed(true)
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [result.id, format, previewAttempt])

  const act = async (action: NonNullable<typeof operation>) => {
    setOperation(action)
    setError(undefined)
    try {
      if (action === 'reveal') await window.electronAPI.revealGeneratedAudio(result.id)
      else {
        const audioId = await window.electronAPI.importGeneratedAudio(result.id)
        setImportedId(audioId)
      }
    } catch {
      setError(action)
    } finally {
      setOperation(undefined)
    }
  }

  const duration = new Intl.NumberFormat(i18n.language, {
    style: 'unit', unit: 'second', maximumFractionDigits: 1
  }).format(result.duration)
  const speedLabel = `${new Intl.NumberFormat(i18n.language).format(speed)}×`

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="audio-generation-dialog audio-generation-result" hideCloseButton>
        <div className="audio-generation-result-heading">
          <span className="audio-generation-result-check" aria-hidden="true"><Check size={22} /></span>
          <div>
            <DialogTitle>{t('audioGeneration.result.title')}</DialogTitle>
            <DialogDescription className="mt-1">
              {t(importedId ? 'audioGeneration.result.imported' : 'audioGeneration.result.description')}
            </DialogDescription>
          </div>
        </div>

        <div className="audio-generation-result-file">
          <div className="audio-generation-file-summary">
            <FileAudio size={22} className="shrink-0 text-primary-ink" aria-hidden="true" />
            <div className="min-w-0">
              <p className="break-all font-medium">{result.name}</p>
              <p className="text-sm text-muted-foreground">
                {[format.toUpperCase(), duration, t(`audioGeneration.options.voices.${voice}`), speedLabel].join(' · ')}
              </p>
            </div>
          </div>
          {previewFailed ? (
            <div className="audio-generation-actions">
              <span role="alert" className="text-sm">{t('audioGeneration.errors.preview')}</span>
              <button className="text-button" onClick={() => {
                setPreviewUrl('')
                setPreviewFailed(false)
                setPreviewAttempt((attempt) => attempt + 1)
              }}>
                <RotateCcw size={14} aria-hidden="true" />
                {t('common.retry')}
              </button>
            </div>
          ) : previewUrl ? (
            <audio
              aria-label={t('audioGeneration.result.preview')}
              className="w-full"
              controls
              src={previewUrl}
              onError={() => setPreviewFailed(true)}
            />
          ) : <p className="text-sm text-muted-foreground" role="status">{t('audioGeneration.result.loadingPreview')}</p>}
        </div>

        {error && <p role="alert" className="inline-error">{t(`audioGeneration.errors.${error}`)}</p>}
        <div className="audio-generation-result-footer audio-generation-actions">
          <button className="text-button" disabled={!!operation} onClick={() => void act('reveal')}>
            <FolderOpen size={16} aria-hidden="true" />
            {t('audioGeneration.result.reveal')}
          </button>
          <div className="audio-generation-actions">
            <button className="secondary-button" onClick={() => onClose()}>{t('common.close')}</button>
            {importedId ? (
              <Link className="primary-button" to={`/audios/${importedId}`} onClick={() => onClose(false)}>
                {t('audioGeneration.result.open')}
              </Link>
            ) : (
              <button className="primary-button" disabled={!!operation} onClick={() => void act('import')}>
                <LibraryBig size={16} aria-hidden="true" />
                {t(operation === 'import' ? 'audioGeneration.result.importing' : 'audioGeneration.result.import')}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
