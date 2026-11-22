import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@renderer/components/ui/dialog'

interface AudioGenerationProgressDialogProps {
  title: string
  detail?: string
  onCancel?: () => Promise<void>
  onCloseAutoFocus: () => void
}

export function AudioGenerationProgressDialog({
  title, detail, onCancel, onCloseAutoFocus
}: AudioGenerationProgressDialogProps) {
  const { t } = useTranslation()
  const [cancellation, setCancellation] = useState<'pending' | 'failed'>()

  const cancel = async () => {
    if (!onCancel || cancellation === 'pending') return
    setCancellation('pending')
    try {
      await onCancel()
    } catch {
      setCancellation('failed')
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="audio-generation-progress-dialog"
        {...(detail ? {} : { 'aria-describedby': undefined })}
        hideCloseButton
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          void cancel()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onCloseAutoFocus()
        }}
      >
        <LoaderCircle className="text-primary-ink motion-safe:animate-spin" size={36} aria-hidden="true" />
        <div role="status" aria-atomic="true" className="space-y-2">
          <DialogTitle>{title}</DialogTitle>
          {detail && <DialogDescription>{detail}</DialogDescription>}
        </div>
        {onCancel && (
          <button type="button" className="secondary-button" disabled={cancellation === 'pending'} onClick={() => void cancel()}>
            {t('common.cancel')}
          </button>
        )}
        {cancellation === 'failed' && <p className="text-sm text-destructive" role="alert">{t('audioGeneration.errors.operation')}</p>}
      </DialogContent>
    </Dialog>
  )
}
