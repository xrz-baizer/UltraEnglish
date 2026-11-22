import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download, FolderOpen, Loader2, Captions, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { SettingsGroup } from './settings-group'
import { Select } from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'

type SttModel = Awaited<
  ReturnType<typeof window.electronAPI.getDownloadedModels>
>[number]
export function AudioSettings() {
  const { t } = useTranslation()
  const { settings, updateAudioSettings, loadSettings } = useSettingsStore()
  const [models, setModels] = useState<SttModel[]>([])
  const [paths, setPaths] = useState({ models: '', audios: '' })
  const [loading, setLoading] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const load = async () => {
    const [models, paths] = await Promise.all([
      window.electronAPI.getDownloadedModels(),
      window.electronAPI.getAudioStoragePaths()
    ])
    setModels(models)
    setPaths(paths)
  }
  useEffect(() => {
    void load()
      .catch(() => toast.error(t('settings.audio.loadFailed')))
      .finally(() => setLoading(false))
    return window.electronAPI.on('stt-model-download-progress', (value) => {
      const { modelId, percent } = value as { modelId: string; percent: number }
      setDownloads((previous) => ({ ...previous, [modelId]: percent }))
    })
  }, [t])
  const chooseDirectory = async (kind: 'models' | 'audios') => {
    setChoosing(true)
    try {
      const path = await window.electronAPI.chooseAudioStorageDirectory(kind)
      if (path) {
        await loadSettings()
        await load()
      }
    } catch {
      toast.error(t('settings.audio.pathFailed'))
    } finally {
      setChoosing(false)
    }
  }
  const download = async (id: string) => {
    setDownloads((previous) => ({ ...previous, [id]: 0 }))
    try {
      if (!(await window.electronAPI.downloadSttModel(id)))
        throw new Error('Download failed')
      await load()
    } catch {
      toast.error(t('settings.audio.downloadFailed'))
    } finally {
      setDownloads((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
    }
  }
  return (
    <div className="space-y-8">
      <SettingsGroup icon={Captions} title={t('settings.audio.subtitleDisplay')}>
        <label className="settings-row flex flex-wrap items-center justify-between gap-4 p-4">
          <span>{t('settings.audio.sentenceFont')}</span>
          <Select
            label={t('settings.audio.sentenceFont')}
            value={settings.audio.sentenceFontFamily}
            onValueChange={(sentenceFontFamily) => void updateAudioSettings({ sentenceFontFamily })}
            options={[
              { value: 'system-ui, -apple-system, sans-serif', label: t('settings.audio.systemFont') },
              { value: 'Arial, sans-serif', label: 'Arial' },
              { value: '"PingFang SC", sans-serif', label: '苹方' }
            ]}
          />
        </label>
        <label className="settings-row flex flex-wrap items-center justify-between gap-4 p-4">
          <span>{t('settings.audio.fontWeight')}</span>
          <Select
            label={t('settings.audio.fontWeight')}
            value={String(settings.audio.sentenceFontWeight || 400)}
            onValueChange={(value) => void updateAudioSettings({ sentenceFontWeight: value === '700' ? 700 : 400 })}
            options={[
              { value: '400', label: t('settings.audio.regular') },
              { value: '700', label: t('settings.audio.bold') }
            ]}
          />
        </label>
        <label className="settings-row flex flex-wrap items-center justify-between gap-4 p-4">
          <span>{t('settings.audio.sentenceSize')}</span>
          <input
            aria-label={t('settings.audio.sentenceSize')}
            type="number"
            min="18"
            max="42"
            className="glass-field w-20 rounded-lg border p-2"
            value={settings.audio.sentenceFontSize}
            onChange={(event) =>
              void updateAudioSettings({
                sentenceFontSize: Math.max(
                  18,
                  Math.min(42, Number(event.target.value) || 26)
                )
              })
            }
          />
        </label>
      </SettingsGroup>
      <SettingsGroup icon={FolderOpen} title={t('settings.storageLocations')}>
        {(['models', 'audios'] as const).map((kind) => (
          <section key={kind} className="settings-row space-y-3 p-4">
            <h4 className="text-sm font-medium">
              {t(
                kind === 'models'
                  ? 'settings.audio.modelDirectory'
                  : 'settings.audio.storageDirectory'
              )}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="min-w-0 flex-1 break-all rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                title={paths[kind]}
              >
                {paths[kind] || '—'}
              </span>
              <button
                className="secondary-button shrink-0"
                disabled={choosing || Object.keys(downloads).length > 0}
                onClick={() => void chooseDirectory(kind)}
              >
                <FolderOpen className="h-4 w-4" />
                {t('settings.audio.chooseFolder')}
              </button>
            </div>
            {kind === 'audios' && (
              <p className="text-xs text-muted-foreground">
                {t('settings.audio.newImportsOnly')}
              </p>
            )}
          </section>
        ))}
      </SettingsGroup>
      <SettingsGroup icon={Mic} title={t('settings.sttModels')}>
        {loading ? (
          <div className="settings-row p-4" role="status" aria-label={t('common.loading')}>
            <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
          </div>
        ) : (
          models.map((model) => (
            <div
              key={model.id}
              className={cn(
                'settings-row settings-model-row flex flex-wrap items-center justify-between gap-3 p-4',
                settings.audio.sttModelId === model.id &&
                  'bg-primary/5'
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="stt-model"
                  value={model.id}
                  disabled={!model.downloaded}
                  checked={settings.audio.sttModelId === model.id}
                  onChange={() =>
                    void updateAudioSettings({
                      sttModelId: model.id,
                      sttModelPath: ''
                    })
                  }
                />
                <span>
                  <span className="text-sm font-medium">{model.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {model.size}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(`settings.modelDescriptions.${model.id}`)}
                  </span>
                </span>
              </label>
              {model.downloaded ? (
                <Check
                  className="h-4 w-4 text-primary-ink"
                  aria-label={t('common.downloaded')}
                />
              ) : downloads[model.id] !== undefined ? (
                <span className="flex items-center gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {downloads[model.id]}%
                </span>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => void download(model.id)}
                >
                  <Download className="h-4 w-4" />
                  {t('common.download')}
                </button>
              )}
            </div>
          ))
        )}
      </SettingsGroup>
    </div>
  )
}
