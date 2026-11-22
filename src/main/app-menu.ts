import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { AppCommand } from '../shared/app-commands'

export function installAppMenu(getMainWindow: () => BrowserWindow | null): void {
  const mac = process.platform === 'darwin'
  const zh = app.getLocale().startsWith('zh')
  const label = (chinese: string, english: string) => (zh ? chinese : english)
  const command = (value: AppCommand) => () => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.webContents.send('app-command', value)
  }
  const settings: MenuItemConstructorOptions = {
    label: label('设置…', 'Settings…'),
    accelerator: 'CmdOrCtrl+,',
    click: command('settings')
  }
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          } as MenuItemConstructorOptions
        ]
      : []),
    {
      label: label('文件', 'File'),
      submenu: [
        {
          label: label('拼写练习', 'Spelling Practice'),
          accelerator: 'CmdOrCtrl+2',
          click: command('vocabulary')
        },
        {
          label: label('跟读训练', 'Shadowing Practice'),
          accelerator: 'CmdOrCtrl+3',
          click: command('audios')
        },
        ...(mac ? [] : [settings]),
        { type: 'separator' },
        { role: mac ? 'close' : 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: label('显示', 'View'),
      submenu: [
        {
          label: label('首页', 'Home'),
          accelerator: 'CmdOrCtrl+1',
          click: command('home')
        },
        {
          label: label('切换侧边栏', 'Toggle Sidebar'),
          accelerator: 'CmdOrCtrl+Shift+L',
          click: command('toggle-sidebar')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' } as MenuItemConstructorOptions] : [])
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: label('关于 UltraEnglish', 'About UltraEnglish'),
          click: () => app.showAboutPanel()
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
