import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactElement } from 'react'

export function ActionTooltip({
  label,
  children,
  showWhenDisabled = false
}: {
  label: string
  showWhenDisabled?: boolean
  children: ReactElement<{ disabled?: boolean }>
}) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {showWhenDisabled && children.props.disabled ? (
            <span className="inline-flex" tabIndex={0} aria-disabled="true" onKeyDown={event=>{if(event.code==='Space'){event.preventDefault();event.stopPropagation()}}}>
              {children}
            </span>
          ) : (
            children
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="action-tooltip"
            side="top"
            sideOffset={10}
            avoidCollisions={false}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
