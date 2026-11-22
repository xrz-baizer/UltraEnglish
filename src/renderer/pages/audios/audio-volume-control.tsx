import { useEffect, useId, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ActionTooltip } from '@renderer/components/ui/action-tooltip'

interface Props {
  volume: number
  onVolumeChange: (volume: number) => void
}

export function AudioVolumeControl({ volume, onVolumeChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const control = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const slider = useRef<HTMLInputElement>(null)
  const Icon = volume === 0 ? VolumeX : Volume2
  const label = t('audio.volume')

  useEffect(() => {
    if (!open) return
    slider.current?.focus({ preventScroll: true })
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !control.current?.contains(event.target))
        setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [open])

  return (
    <div
      className="audio-volume-control"
      ref={control}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }}
    >
      <ActionTooltip label={label}>
        <button
          ref={trigger}
          className="icon-button"
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </ActionTooltip>
      {open && (
        <div id={panelId} className="audio-volume-popover">
          <input
            ref={slider}
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label={label}
            aria-valuetext={`${volume}%`}
            onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber)}
          />
          <span className="tabular-nums" aria-hidden="true">{volume}%</span>
        </div>
      )}
    </div>
  )
}
