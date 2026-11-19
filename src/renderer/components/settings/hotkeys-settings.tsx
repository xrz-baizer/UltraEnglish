import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Tabs from '@radix-ui/react-tabs'
import { RotateCcw } from 'lucide-react'
import { useSettingsStore, defaultSettings } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'

type HotkeyKey = 'prevWord' | 'nextWord' | 'showDefinition' | 'showWord' | 'favoriteWord'
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
const hotkeyItems: { key: HotkeyKey; labelKey: string; descKey: string }[] = [
  { key: 'prevWord', labelKey: 'prevWord', descKey: 'prevWordDesc' },
  { key: 'nextWord', labelKey: 'nextWord', descKey: 'nextWordDesc' },
  { key: 'showDefinition', labelKey: 'showDefinition', descKey: 'showDefinitionDesc' },
  { key: 'showWord', labelKey: 'showWord', descKey: 'showWordDesc' },
  { key: 'favoriteWord', labelKey: 'favoriteWord', descKey: 'favoriteWordDesc' }
]
const audioShortcuts = [
  { key: 'Space', label: 'audioPlay', description: 'audioPlayDesc' },
  { key: 'ArrowLeft', label: 'audioPreviousPlay', description: 'audioPreviousPlayDesc' },
  { key: 'ArrowRight', label: 'audioNextPlay', description: 'audioNextPlayDesc' },
  { key: 'ArrowUp', label: 'audioPreviousSilent', description: 'audioPreviousSilentDesc' },
  { key: 'ArrowDown', label: 'audioNextSilent', description: 'audioNextSilentDesc' },
  { key: 'Escape', label: 'audioClear', description: 'audioClearDesc' },
  { key: 'shift+ArrowLeft / shift+ArrowRight', label: 'audioExtend', description: 'audioExtendDesc' },
  { key: 'Enter', label: 'audioSelection', description: 'audioSelectionDesc' },
  { key: `${isMac ? 'meta' : 'ctrl'}+c`, label: 'audioCopy', description: 'audioCopyDesc' },
  { key: 'ArrowLeft / ArrowRight', label: 'audioPanels', description: 'audioPanelsDesc' },
  { key: 'ArrowUp / ArrowDown', label: 'audioTrack', description: 'audioTrackDesc' }
]

function formatKey(key: string): string {
  const keys: Record<string, string> = {
    arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', tab: 'Tab', enter: 'Enter', space: 'Space',
    backspace: isMac ? '⌫' : 'Backspace', delete: 'Del', ctrl: 'Ctrl', alt: isMac ? '⌥' : 'Alt', shift: 'Shift', meta: isMac ? '⌘' : 'Win'
  }
  return key.split(' / ').map(combination => combination.split('+').map(part => keys[part.toLowerCase()] || part.toUpperCase()).join(' + ')).join(' / ')
}

function FixedShortcut({ keys, label, description }: { keys: string; label: string; description: string }) {
  const { t } = useTranslation()
  return (
    <div className="shortcut-row">
      <div className="min-w-0"><h4>{t(`settings.hotkeys.${label}`)}</h4><p>{t(`settings.hotkeys.${description}`)}</p></div>
      <kbd>{formatKey(keys)}</kbd>
    </div>
  )
}

export function HotkeysSettings() {
  const { t } = useTranslation()
  const { settings, updateHotkeySettings } = useSettingsStore()
  const [recording, setRecording] = useState<HotkeyKey | null>(null)
  const recordKey = (event: React.KeyboardEvent, key: HotkeyKey) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') { setRecording(null); return }
    if (event.nativeEvent.isComposing || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
    // Unmodified printable keys are used to type the answer in practice.
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) return
    const parts = [event.ctrlKey && 'ctrl', event.altKey && 'alt', event.shiftKey && 'shift', event.metaKey && 'meta', event.key].filter(Boolean)
    void updateHotkeySettings({ [key]: parts.join('+') })
    setRecording(null)
  }
  return (
    <Tabs.Root defaultValue="vocabulary" className="hotkeys-settings" onValueChange={() => setRecording(null)}>
      <Tabs.List className="shortcut-tabs" aria-label={t('settings.hotkeys.categoryLabel')}>
        <Tabs.Trigger value="vocabulary">{t('settings.hotkeys.vocabularyCategory')}</Tabs.Trigger>
        <Tabs.Trigger value="audio">{t('settings.hotkeys.audioCategory')}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="vocabulary" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('settings.hotkeys.info')}</p>
          <button className="secondary-button" onClick={() => void updateHotkeySettings(defaultSettings.hotkeys)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{t('settings.hotkeys.resetDefaults')}
          </button>
        </div>
        <div className="shortcut-list">
          {hotkeyItems.map(item => (
            <div key={item.key} className="shortcut-row">
              <div className="min-w-0"><h4>{t(`settings.hotkeys.${item.labelKey}`)}</h4><p>{t(`settings.hotkeys.${item.descKey}`)}</p></div>
              <button
                aria-label={t('settings.hotkeys.editShortcut', { action: t(`settings.hotkeys.${item.labelKey}`) })}
                aria-pressed={recording === item.key}
                className={cn('shortcut-binding', recording === item.key && 'is-recording')}
                onClick={() => setRecording(recording === item.key ? null : item.key)}
                onKeyDown={event => { if (recording === item.key) recordKey(event, item.key) }}
                onBlur={() => setRecording(null)}
              >{recording === item.key ? t('settings.hotkeys.pressKey') : formatKey(settings.hotkeys[item.key])}</button>
            </div>
          ))}
          <FixedShortcut keys="Backspace" label="wordDelete" description="wordDeleteDesc" />
          <FixedShortcut keys="Enter" label="wordSubmit" description="wordSubmitDesc" />
          <FixedShortcut keys="Space / Enter" label="sentenceSubmit" description="sentenceSubmitDesc" />
        </div>
      </Tabs.Content>
      <Tabs.Content value="audio" className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('settings.hotkeys.audioScope')}</p>
        <div className="shortcut-list">{audioShortcuts.map(item => <FixedShortcut key={item.label} keys={item.key} label={item.label} description={item.description} />)}</div>
      </Tabs.Content>
    </Tabs.Root>
  )
}
