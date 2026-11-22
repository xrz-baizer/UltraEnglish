import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Check, Download, FolderOpen, RotateCcw, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AudioGenerationDownloadStatus, useGenerationFileSize } from '@renderer/components/audio-generation-download-status'
import { useAudioGenerationResources } from '@renderer/hooks/use-audio-generation-resources'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsGroup } from './settings-group'
import { cn } from '@renderer/lib/utils'
import { isGenerationQuality } from '../../../shared/audio-generation'
import type { GenerationDirectory, GenerationPaths } from '../../../shared/audio-generation'

export function AudioGenerationSettings() {
  const { t } = useTranslation()
  const size = useGenerationFileSize()
  const { resources, download, fault, refresh, startDownload } = useAudioGenerationResources()
  const selection = useSettingsStore((settings) => settings.settings.audioGeneration)
  const updateSelection = useSettingsStore((settings) => settings.updateAudioGenerationSettings)
  const [paths, setPaths] = useState<GenerationPaths>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<{ kind?: GenerationDirectory; detail: string }>()
  const modelsHeading = useRef<HTMLHeadingElement>(null)
  const voicesHeading = useRef<HTMLHeadingElement>(null)
  const readPaths = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      setPaths(await window.electronAPI.getAudioGenerationPaths())
    } catch (error) {
      setError({ detail: String(error) })
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void readPaths()
  }, [readPaths])

  const change = async (kind: GenerationDirectory, reset: boolean) => {
    setBusy(true)
    setError(undefined)
    try {
      const result = reset
        ? await window.electronAPI.resetAudioGenerationPath(kind)
        : await window.electronAPI.chooseAudioGenerationPath(kind)
      if (result) setPaths(result)
    } catch (error) {
      const detail = error instanceof Error ? error.message.replace(/^.*?: Error: /, '') : String(error)
      setError({ kind, detail })
    } finally {
      setBusy(false)
    }
  }

  if (!paths) {
    return error ? (
      <div className="inline-error" role="alert">
        {t('audioGeneration.settings.loadFailed')}
        <button className="text-button" onClick={readPaths}>{t('common.retry')}</button>
      </div>
    ) : <p role="status">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-8">
      {resources && (['models', 'voices'] as const).map((group) => {
        const groupId = `generation-settings-${group}`
        const isModelGroup = group === 'models'
        return (
          <SettingsGroup key={group} icon={isModelGroup ? AudioLines : Volume2}
            title={t(`audioGeneration.settings.${group}`)} headingId={groupId}
            headingRef={isModelGroup ? modelsHeading : voicesHeading} panelRole="radiogroup">
            {resources.filter(({ id }) => isGenerationQuality(id) === isModelGroup).map((resource) => {
              const { id } = resource
              const isModel = isGenerationQuality(id)
              const label = isModel ? t(`audioGeneration.options.qualities.${id}`) : t(`audioGeneration.options.voices.${id}`)
              const selected = isModel ? selection.quality === id : selection.voice === id
              return (
                <div key={id} className={cn(
                  'settings-row settings-model-row flex flex-wrap items-center justify-between gap-3 p-4',
                  selected && 'bg-primary/5'
                )}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="radio" name={groupId} value={id} checked={selected}
                      disabled={!resource.ready || !!download}
                      onChange={() => void updateSelection(isModel ? { quality: id } : { voice: id })} />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {size(resource.bytes)} · {t(resource.ready ? 'audioGeneration.model.ready' : 'audioGeneration.model.missing')}
                      </span>
                    </span>
                  </label>
                  {resource.ready ? (
                    <Check className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  ) : (
                    <button type="button" className="secondary-button shrink-0"
                      aria-label={t('audioGeneration.model.downloadResource', { name: label })}
                      disabled={!!download || busy} onClick={() => void startDownload([id])}>
                      <Download size={16} aria-hidden="true" />
                      {t('common.download')}
                    </button>
                  )}
                </div>
              )
            })}
          </SettingsGroup>
        )
      })}
      {!resources && !fault && <p role="status">{t('common.loading')}</p>}
      {download && <AudioGenerationDownloadStatus download={download} onCloseAutoFocus={() => {
        const heading = download.ids.some(isGenerationQuality) ? modelsHeading : voicesHeading
        heading.current?.focus()
      }} />}
      {fault && (
        <div className="inline-error" role="alert">
          {t(fault === 'load' ? 'audioGeneration.errors.resources' : 'audioGeneration.errors.download')}
          {fault === 'load' && <button type="button" className="text-button" onClick={() => void refresh()}>{t('common.retry')}</button>}
        </div>
      )}
      <SettingsGroup icon={FolderOpen} title={t('settings.storageLocations')} headingId="generation-directory-heading">
        {(['model', 'output'] as const).map((kind) => (
          <div key={kind} className="settings-row space-y-3 p-4">
            <h4 className="text-sm font-semibold">{t(`audioGeneration.settings.${kind}`)}</h4>
            <p className="glass-field break-all rounded-lg border px-3 py-2 text-sm" dir="auto">{paths[kind]}</p>
            <div className="audio-generation-actions">
              <button className="secondary-button" disabled={busy || (kind === 'model' && !!download)} onClick={() => void change(kind, false)}>
                <FolderOpen size={16} aria-hidden="true" />
                {t('audioGeneration.settings.choose')}
              </button>
              <button className="text-button" disabled={busy || (kind === 'model' && !!download)} onClick={() => void change(kind, true)}>
                <RotateCcw size={15} aria-hidden="true" />
                {t('audioGeneration.settings.reset')}
              </button>
            </div>
            {error?.kind === kind && (
              <p className="inline-error break-all" role="alert">
                {t('audioGeneration.settings.pathFailed', { detail: error.detail })}
              </p>
            )}
          </div>
        ))}
      </SettingsGroup>
    </div>
  )
}
