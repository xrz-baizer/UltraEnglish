import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { initializeAudioStorage } from './services/audio-storage'
import { registerIpcHandlers } from './db/handlers'
import { seedBuiltInDictionaries } from './db/seed'
import { seedBuiltInAudio } from './db/seed-audio'
import log from 'electron-log'
import { installAppMenu } from './app-menu'
import { getWindowAppearance, updateWindowMaterials } from './window-appearance'

const appIcon = join(__dirname, '../../assets/icons/icon.png')

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Suppress Autofill protocol noise from DevTools in Electron.
app.commandLine.appendSwitch('disable-features', 'Autofill,AutofillServerCommunication')

let mainWindow: BrowserWindow | null = null

const focusMainWindow = async (): Promise<boolean> => {
  const win =
    (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null) ||
    BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
  if (!win) return false

  if (win.isMinimized()) {
    win.restore()
  }
  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
  return true
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    icon: appIcon,
    title: 'UltraEnglish',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#f5f5f7',
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 20, y: 23 },
      vibrancy: 'sidebar' as const,
      visualEffectState: 'followWindow' as const
    } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in development
  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }

  mainWindow = win
  updateWindowMaterials()
  return win
}

let initialized = false

const createMainWindow = async (): Promise<void> => {
  if (!initialized) {
    // Initialize database
    try {
      await initDatabase()
      await initializeAudioStorage()
      log.info('Database initialized successfully')

      // Seed built-in dictionaries (only runs once)
      await seedBuiltInDictionaries()
      await seedBuiltInAudio()
    } catch (error) {
      log.error('Failed to initialize database:', error)
    }

    // Register IPC handlers
    registerIpcHandlers()

    initialized = true
  }

  // Create the browser window
  createWindow()
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(appIcon)
  installAppMenu(() => mainWindow)
  ipcMain.handle('window-get-appearance', () => getWindowAppearance())
  ipcMain.handle('window-set-appearance', (_, theme: unknown) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return false
    nativeTheme.themeSource = theme
    updateWindowMaterials()
    return true
  })
  nativeTheme.on('updated', updateWindowMaterials)
  createMainWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    focusMainWindow().then((focused) => {
      if (!focused) {
        createMainWindow()
      }
    })
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
