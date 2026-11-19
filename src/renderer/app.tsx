import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/theme-provider'
import { Toaster } from 'sonner'
import { Layout } from './components/layouts/layout'
import { SettingsModal } from './components/settings'
import { AuthModal } from './components/auth'
import { useSettingsStore } from './stores/settings-store'
import './i18n'

// Pages
import { HomePage } from './pages/home'
import { VocabularyPage } from './pages/vocabulary'
import { BookDetailPage } from './pages/vocabulary/book'
import { VocabularyPracticePage } from './pages/vocabulary/practice'
import { ImportVocabularyWindow } from './pages/vocabulary/import-window'
import { AudiosPage } from './pages/audios'
import { AudioDetailPage } from './pages/audios/detail'
import { LoginPage } from './pages/auth/login'
import { RegisterPage } from './pages/auth/register'

const toastStyle = {
  '--normal-bg': 'var(--glass-overlay)',
  '--normal-bg-hover': 'hsl(var(--secondary))',
  '--normal-text': 'hsl(var(--popover-foreground))',
  '--normal-border': 'hsl(var(--input))'
} as CSSProperties

export function App() {
  const { settings, loadSettings } = useSettingsStore()
  const isImportWindow = useMemo(() => {
    return new URLSearchParams(window.location.search).get('window') === 'import-vocabulary'
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    window.electronAPI.setZoomFactor(settings.basic.zoom / 100)
  }, [settings.basic.zoom])

  useEffect(() => {
    const scale = Math.min(150, Math.max(90, settings.basic.fontScale || 100)) / 100
    document.documentElement.style.setProperty('--font-scale', String(scale))
  }, [settings.basic.fontScale])

  if (isImportWindow) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="ultra-english-theme">
        <ImportVocabularyWindow />
        <Toaster position="top-center" style={toastStyle} toastOptions={{ className: 'glass-toast', descriptionClassName: 'text-muted-foreground' }} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="ultra-english-theme">
      <HashRouter>
        <Routes>
          {/* Auth routes (no layout) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Main routes (with layout) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
            <Route path="vocabulary/:bookId" element={<BookDetailPage />} />
            <Route path="vocabulary/:bookId/practice" element={<VocabularyPracticePage />} />
            <Route path="audios" element={<AudiosPage />} />
            <Route path="audios/:id" element={<AudioDetailPage />} />
          </Route>
        </Routes>
      </HashRouter>
      <SettingsModal />
      <AuthModal />
      <Toaster position="top-center" style={toastStyle} toastOptions={{ className: 'glass-toast', descriptionClassName: 'text-muted-foreground' }} />
    </ThemeProvider>
  )
}
