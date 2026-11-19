import { BrowserWindow, nativeTheme } from 'electron'
import type { WindowAppearance } from '../shared/app-commands'

export function getWindowAppearance(): WindowAppearance {
  return {
    platform: process.platform,
    reducedTransparency: nativeTheme.prefersReducedTransparency,
    highContrast: nativeTheme.shouldUseHighContrastColors
  }
}

export function updateWindowMaterials(): void {
  const appearance = getWindowAppearance()
  for (const win of BrowserWindow.getAllWindows()) {
    if (process.platform === 'darwin') {
      const opaque = appearance.reducedTransparency || appearance.highContrast
      win.setVibrancy(opaque ? null : 'sidebar')
      win.setBackgroundColor(
        opaque ? (nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7') : '#00000000'
      )
    }
    win.webContents.send('window-appearance-changed', appearance)
  }
}
