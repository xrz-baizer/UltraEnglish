import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  label: string
  className?: string
  disabled?: boolean
}

export function Select({ value, onValueChange, options, label, className, disabled }: SelectProps) {
  const selectedIndex = options.findIndex(option => option.value === value)
  return (
    <SelectPrimitive.Root
      value={selectedIndex < 0 ? '' : `option-${selectedIndex}`}
      onValueChange={key => {
        const option = options[Number(key.slice('option-'.length))]
        if (option && !option.disabled) onValueChange(option.value)
      }}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger className={cn('select-trigger', className)} aria-label={label} title={options[selectedIndex]?.label}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
          <SelectPrimitive.ScrollUpButton className="select-scroll-button"><ChevronUp className="h-4 w-4" aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {options.map((option, index) => (
              <SelectPrimitive.Item key={option.value} value={`option-${index}`} disabled={option.disabled} className="select-item">
                <SelectPrimitive.ItemIndicator className="select-indicator"><Check className="h-4 w-4" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll-button"><ChevronDown className="h-4 w-4" aria-hidden="true" /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
