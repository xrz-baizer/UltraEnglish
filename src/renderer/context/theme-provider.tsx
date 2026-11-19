import { createContext, useContext, useEffect, useState } from 'react'
import { normalizeTheme, type Theme } from '@renderer/lib/theme'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => normalizeTheme(localStorage.getItem(storageKey), defaultTheme)
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.inputModality = 'keyboard'
    const onPointerDown = () => { root.dataset.inputModality = 'pointer' }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) root.dataset.inputModality = 'keyboard'
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      root.classList.remove('light', 'dark', 'eye-protection')
      root.classList.add(theme === 'system' ? (media.matches ? 'dark' : 'light') : theme)
    }
    applyTheme()
    localStorage.setItem(storageKey, theme)
    media.addEventListener('change', applyTheme)
    void window.electronAPI.setWindowAppearance(theme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    const applyAppearance = (appearance: { platform: string; reducedTransparency: boolean; highContrast: boolean }) => {
      const root = document.documentElement
      root.dataset.platform = appearance.platform
      root.dataset.opaque = String(appearance.reducedTransparency || appearance.highContrast)
      root.dataset.highContrast = String(appearance.highContrast)
    }
    let active = true
    void window.electronAPI.getWindowAppearance().then(appearance => { if (active) applyAppearance(appearance) })
    const unsubscribe = window.electronAPI.on('window-appearance-changed', appearance => {
      applyAppearance(appearance as Parameters<typeof applyAppearance>[0])
    })
    return () => { active = false; unsubscribe() }
  }, [])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
