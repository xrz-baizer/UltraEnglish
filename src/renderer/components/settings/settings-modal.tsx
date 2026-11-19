import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  User,
  Settings,
  BookOpen,
  Headphones,
  Keyboard,
  X
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'
import { BasicSettings } from './basic-settings'
import { VocabularySettings } from './vocabulary-settings'
import { AudioSettings } from './audio-settings'
import { HotkeysSettings } from './hotkeys-settings'
import { UserSettings } from './user-settings'

const categories = [
  { id: 'basic', icon: Settings, labelKey: 'settings.categories.basic' },
  { id: 'user', icon: User, labelKey: 'settings.categories.user' },
  { id: 'vocabulary', icon: BookOpen, labelKey: 'settings.categories.vocabulary' },
  { id: 'audio', icon: Headphones, labelKey: 'settings.categories.audio' },
  { id: 'hotkeys', icon: Keyboard, labelKey: 'settings.categories.hotkeys' }
]

export function SettingsModal() {
  const { t } = useTranslation()
  const { isOpen, setOpen, activeCategory, setActiveCategory, loadSettings, isLoading } =
    useSettingsStore()

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen, loadSettings])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )
    }

    switch (activeCategory) {
      case 'user':
        return <UserSettings />
      case 'basic':
        return <BasicSettings />
      case 'vocabulary':
        return <VocabularySettings />
      case 'audio':
        return <AudioSettings />
      case 'hotkeys':
        return <HotkeysSettings />
      default:
        return <BasicSettings />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="settings-dialog max-w-4xl gap-0 overflow-hidden p-0 sm:rounded-2xl"
        aria-describedby={undefined}
        hideCloseButton
        onEscapeKeyDown={event => {
          if (event.target instanceof Element && event.target.closest('.shortcut-binding[aria-pressed="true"]')) event.preventDefault()
        }}
      >
        <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
        <div className="flex h-[min(600px,85dvh)]">
          {/* Sidebar */}
          <div className="settings-navigation w-56 shrink-0 border-r border-border/50 bg-muted/30">
            <div className="settings-titlebar flex h-14 items-center border-b border-border/50 px-4">
              <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
            </div>
            <nav className="space-y-1.5 p-3">
              {categories.map((category) => {
                const Icon = category.icon
                const isActive = activeCategory === category.id
                return (
                  <button
                    key={category.id}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary-ink'
                        : 'text-[color:var(--sidebar-text)] hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(category.labelKey)}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="min-w-0 flex flex-1 flex-col overflow-hidden">
            <div className="settings-titlebar flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-6">
              <h3 className="text-base font-medium">
                {t(categories.find((c) => c.id === activeCategory)?.labelKey || '')}
              </h3>
              <button
                aria-label={t('common.close')}
                onClick={() => setOpen(false)}
                className="icon-button rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="settings-reading-surface min-h-0 flex-1 overflow-y-auto thin-scrollbar p-6">{renderContent()}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
