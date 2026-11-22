import { useId } from 'react'
import type { ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'

interface SettingsGroupProps {
  title: string
  icon: LucideIcon
  children: ReactNode
  headingId?: string
  headingRef?: Ref<HTMLHeadingElement>
  panelRole?: 'radiogroup'
}

export function SettingsGroup({
  title, icon: Icon, children, headingId, headingRef, panelRole
}: SettingsGroupProps) {
  const generatedId = useId()
  const id = headingId ?? generatedId

  return (
    <section className="space-y-4" aria-labelledby={id}>
      <div className="settings-group-heading flex items-center gap-2 border-b border-border/40 pb-2">
        <Icon className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
        <h3 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-lg font-semibold">
          {title}
        </h3>
      </div>
      <div
        className="settings-panel settings-list settings-group-panel divide-y divide-border/50"
        role={panelRole}
        aria-labelledby={panelRole ? id : undefined}
      >
        {children}
      </div>
    </section>
  )
}
