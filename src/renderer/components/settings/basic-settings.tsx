import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useTheme } from '@renderer/context/theme-provider'
import { cn } from '@renderer/lib/utils'
import type { Theme } from '@renderer/lib/theme'

const themeOptions = [
  { value: 'light', icon: Sun, labelKey: 'settings.themes.light' },
  { value: 'dark', icon: Moon, labelKey: 'settings.themes.dark' },
  { value: 'system', icon: Monitor, labelKey: 'settings.themes.system' }
] as const

const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' }
] as const

export function BasicSettings() {
  const { t, i18n } = useTranslation()
  const { theme: currentTheme, setTheme } = useTheme()
  const { settings, updateBasicSettings } = useSettingsStore()
  const zoom = settings.basic.zoom
  const fontScale = settings.basic.fontScale || 100
  const changeFontScale = (value: number) =>
    updateBasicSettings({ fontScale: Math.min(150, Math.max(90, value)) })

  const clampZoom = (value: number) => Math.min(140, Math.max(80, value))

  const handleThemeChange = (
    theme: Theme
  ) => {
    setTheme(theme)
    updateBasicSettings({ theme })
  }

  const handleLanguageChange = (language: 'zh-CN' | 'en') => {
    i18n.changeLanguage(language)
    updateBasicSettings({ language })
  }

  const handleZoomChange = (value: number) => {
    updateBasicSettings({ zoom: clampZoom(value) })
  }

  return (
    <div className="settings-panel space-y-8">
      {/* Theme */}
      <div className="settings-row space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t('settings.theme')}</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => {
            const Icon = option.icon
            const isActive = currentTheme === option.value
            return (
              <button
                key={option.value}
                aria-pressed={isActive}
                onClick={() => handleThemeChange(option.value)}
                className={cn('glass-control',
                  'group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-300',
                  isActive
                    ? 'border-primary bg-accent'
                    : 'border-transparent '
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-background text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary-ink'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  {t(option.labelKey)}
                </span>
                {isActive && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Language */}
      <div className="settings-row space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t('settings.language')}</h4>
        </div>
        <div className="flex gap-3">
          {languageOptions.map((option) => {
            const isActive = i18n.language === option.value
            return (
              <button
                key={option.value}
                aria-pressed={isActive}
                onClick={() => handleLanguageChange(option.value)}
                className={cn('glass-control',
                  'flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-all duration-200',
                  isActive
                    ? 'border-primary bg-accent'
                    : 'border-transparent '
                )}
              >
                <span
                  className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-primary-ink' : 'text-muted-foreground'
                  )}
                >
                  {option.label}
                </span>
                {isActive && <Check className="h-4 w-4 text-primary-ink" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="settings-row space-y-4">
        <label
          htmlFor="font-scale"
          className="flex items-center justify-between text-sm font-medium"
        >
          <span>{t('settings.fontScale')}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-primary/5"
            disabled={fontScale <= 90}
            onClick={() => changeFontScale(fontScale - 10)}
          >
            −10%
          </button>
          <button
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-primary/5"
            onClick={() => changeFontScale(100)}
          >
            {t('settings.zoomReset')}
          </button>
          <button
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-primary/5"
            disabled={fontScale >= 150}
            onClick={() => changeFontScale(fontScale + 10)}
          >
            +10%
          </button>
          <output className="ml-auto rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
            {fontScale}%
          </output>
        </div>
        <input
          id="font-scale"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${((fontScale - 90) / 60) * 100}%, hsl(var(--muted)) ${((fontScale - 90) / 60) * 100}%)`
          }}
          type="range"
          min="90"
          max="150"
          step="5"
          value={settings.basic.fontScale || 100}
          onChange={(e) =>
            updateBasicSettings({ fontScale: Number(e.target.value) })
          }
        />
      </div>
      {/* Zoom */}
      <div className="settings-row space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t('settings.zoom')}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleZoomChange(zoom - 10)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            -10%
          </button>
          <button
            onClick={() => handleZoomChange(100)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            {t('settings.zoomReset')}
          </button>
          <button
            onClick={() => handleZoomChange(zoom + 10)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            +10%
          </button>
          <div className="ml-auto flex min-w-[80px] items-center justify-center rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground">
            {zoom}%
          </div>
        </div>
        <input
          type="range"
          min={80}
          max={140}
          step={5}
          value={zoom}
          onChange={(e) => handleZoomChange(parseInt(e.target.value, 10))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((zoom - 80) / 60) * 100}%, hsl(var(--muted)) ${((zoom - 80) / 60) * 100}%, hsl(var(--muted)) 100%)`
          }}
        />
      </div>
    </div>
  )
}
