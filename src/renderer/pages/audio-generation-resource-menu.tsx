import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Ref } from 'react'
import { Check, ChevronDown, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGenerationFileSize } from '@renderer/components/audio-generation-download-status'
import type { GenerationResource, GenerationResourceId } from '../../shared/audio-generation'

interface AudioGenerationResourceMenuProps<Id extends GenerationResourceId> {
  kind: 'quality' | 'voice'
  ids: readonly Id[]
  selected: Id
  label: (id: Id) => string
  resources?: GenerationResource[]
  triggerRef: Ref<HTMLButtonElement>
  disabled: boolean
  downloading: boolean
  invalid: boolean
  onValueChange: (id: Id) => void
  onDownload: (id: Id) => void
}

export function AudioGenerationResourceMenu<Id extends GenerationResourceId>({
  kind, ids, selected, label, resources, triggerRef, disabled, downloading, invalid, onValueChange, onDownload
}: AudioGenerationResourceMenuProps<Id>) {
  const { t } = useTranslation()
  const size = useGenerationFileSize()
  const title = t(`audioGeneration.options.${kind}`)
  const current = resources?.find((resource) => resource.id === selected)
  const readiness = (ready: boolean | undefined) => {
    if (ready === undefined) return t('audioGeneration.model.checking')
    return t(ready ? 'audioGeneration.model.ready' : 'audioGeneration.model.missing')
  }

  return (
    <div className="audio-generation-option">
      <span>{title}</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          type="button"
          ref={triggerRef}
          className="select-trigger audio-generation-resource-trigger"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid && !downloading ? 'generation-resources-error' : undefined}
          aria-label={`${title} · ${label(selected)} · ${readiness(current?.ready)}`}
        >
          <span>{label(selected)}</span>
          <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="book-actions-menu audio-generation-resource-menu" align="start" sideOffset={6}>
            <DropdownMenu.RadioGroup aria-label={title} value={selected} onValueChange={(value) => {
              const id = ids.find((id) => id === value)
              if (id !== undefined) onValueChange(id)
            }}>
              {ids.map((id) => {
                const resource = resources?.find((entry) => entry.id === id)
                return (
                  <DropdownMenu.RadioItem key={id} value={id} onSelect={(event) => event.preventDefault()}>
                    <span className="audio-generation-resource-item-label">
                      <span>{label(id)}</span>
                      {resource && <span className="text-xs text-muted-foreground">{size(resource.bytes)} · {readiness(resource.ready)}</span>}
                    </span>
                    <DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                )
              })}
            </DropdownMenu.RadioGroup>
            {current && !current.ready && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item disabled={downloading} onSelect={() => onDownload(selected)}>
                  <Download size={16} aria-hidden="true" />
                  {t(kind === 'quality' ? 'audioGeneration.model.downloadModel' : 'audioGeneration.model.downloadVoice', { size: size(current.bytes) })}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
