import { useTranslation } from 'react-i18next'
import { AudioGenerationProgressDialog } from './audio-generation-progress-dialog'
import type { GenerationDownload } from '../../shared/audio-generation'

export function useGenerationFileSize() {
  const { i18n } = useTranslation()
  const format = new Intl.NumberFormat(i18n.language, {
    style: 'unit', unit: 'megabyte', unitDisplay: 'short', maximumFractionDigits: 2
  })
  return (bytes: number) => format.format(bytes / 1_000_000)
}

interface AudioGenerationDownloadStatusProps {
  download: GenerationDownload
  onCloseAutoFocus: () => void
}

export function AudioGenerationDownloadStatus({ download, onCloseAutoFocus }: AudioGenerationDownloadStatusProps) {
  const { t } = useTranslation()
  const size = useGenerationFileSize()
  return (
    <AudioGenerationProgressDialog
      title={t('audioGeneration.model.downloading')}
      detail={download.bytes
        ? t('audioGeneration.model.progress', { received: size(download.received), total: size(download.bytes) })
        : undefined}
      onCancel={() => window.electronAPI.cancelAudioGenerationDownload()}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  )
}
