import { useTranslation } from 'react-i18next'
import { User, Camera } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'

export function UserSettings() {
  const { t } = useTranslation()
  const { settings, updateUserSettings } = useSettingsStore()

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-background">
            {settings.user.avatar ? (
              <img
                src={settings.user.avatar}
                alt={settings.user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-10 w-10 text-primary-ink/50" />
            )}
          </div>
          <button
            className="glass-primary absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
            onClick={() => {
              // TODO: Implement avatar upload
              console.log('Upload avatar')
            }}
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1">

        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('settings.user.name')}</label>
        <input
          type="text"
          value={settings.user.name}
          onChange={(e) => updateUserSettings({ name: e.target.value })}
          placeholder={t('settings.user.namePlaceholder')}
          className={cn('glass-field',
            'w-full rounded-lg border px-4 py-2.5 text-sm',
            'placeholder:text-muted-foreground',
            ' focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
            'transition-all duration-200'
          )}
        />

      </div>
    </div>
  )
}
