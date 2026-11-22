import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@renderer/components/ui/dialog'
import {
  defaultGenerationName, isValidGenerationName, normalizeGenerationName
} from '../../shared/audio-generation'
import type { GenerationFormat, GenerationSaveLocation } from '../../shared/audio-generation'

interface AudioGenerationSaveDialogProps {
  format: GenerationFormat
  onClose: () => void
  onConfirm: (name: string, locationToken: string) => void
}

export function AudioGenerationSaveDialog({ format, onClose, onConfirm }: AudioGenerationSaveDialogProps) {
  const { t } = useTranslation()
  const [suggestedName] = useState(defaultGenerationName)
  const [name, setName] = useState(suggestedName)
  const [location, setLocation] = useState<GenerationSaveLocation>()
  const [loadingLocation, setLoadingLocation] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [pathFailed, setPathFailed] = useState<'load' | 'choose'>()
  const normalizedName = normalizeGenerationName(name)
  const invalid = !isValidGenerationName(normalizedName)

  useEffect(() => {
    let active = true
    void window.electronAPI.getAudioGenerationSaveLocation().then((defaultLocation) => {
      if (active) setLocation(defaultLocation)
    }).catch(() => {
      if (active) setPathFailed('load')
    }).finally(() => {
      if (active) setLoadingLocation(false)
    })
    return () => { active = false }
  }, [])

  const chooseLocation = async () => {
    setChoosing(true)
    setPathFailed(undefined)
    try {
      const chosen = await window.electronAPI.chooseAudioGenerationSaveLocation(location?.token)
      if (chosen) setLocation(chosen)
    } catch {
      setPathFailed('choose')
    } finally {
      setChoosing(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="audio-generation-dialog" hideCloseButton>
        <DialogTitle>{t('audioGeneration.saveDialog.title')}</DialogTitle>
        <DialogDescription>{t('audioGeneration.saveDialog.description', { format: format.toUpperCase() })}</DialogDescription>
        <form className="audio-generation-save-form" onSubmit={(event) => {
          event.preventDefault()
          if (location && !choosing && !invalid) onConfirm(normalizedName || suggestedName, location.token)
        }}>
          <label className="audio-generation-save-field">
            {t('audioGeneration.saveDialog.name')}
            <input className="glass-field rounded-lg border px-3 py-2" value={name} maxLength={180}
              placeholder={suggestedName} onChange={(event) => setName(event.target.value)}
              aria-invalid={invalid} aria-describedby={invalid ? 'generation-name-error' : undefined} />
          </label>
          {invalid && (
            <p className="text-sm text-destructive" id="generation-name-error" role="alert">
              {t('audioGeneration.saveDialog.invalidName')}
            </p>
          )}
          <div className="audio-generation-save-field">
            <label htmlFor="generation-save-location">{t('audioGeneration.saveDialog.path')}</label>
            <div className="audio-generation-save-location">
              <input id="generation-save-location" className="glass-field rounded-lg border px-3 py-2"
                value={location?.path ?? ''} title={location?.path} readOnly
                placeholder={loadingLocation ? t('common.loading') : undefined} />
              <button type="button" className="secondary-button" disabled={loadingLocation || choosing}
                onClick={() => void chooseLocation()}>
                <FolderOpen size={16} aria-hidden="true" />
                {t('audioGeneration.settings.choose')}
              </button>
            </div>
          </div>
          {pathFailed && <p role="alert" className="text-sm text-destructive">
            {t(pathFailed === 'load' ? 'audioGeneration.settings.loadFailed' : 'audioGeneration.saveDialog.chooseFailed')}
          </p>}
          <div className="audio-generation-actions justify-end">
            <button type="button" className="secondary-button" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="primary-button" disabled={!location || choosing || invalid}>{t('audioGeneration.title')}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
