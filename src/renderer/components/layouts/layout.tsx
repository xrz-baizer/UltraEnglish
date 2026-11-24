import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function Layout() {
  const navigate = useNavigate()
  const openSettings = useSettingsStore((state) => state.setOpen)

  useEffect(
    () =>
      window.electronAPI.onAppCommand((command) => {
        if (command === 'settings') openSettings(true)
        else
          navigate(
            { home: '/', vocabulary: '/vocabulary', audios: '/audios' }[command]
          )
      }),
    [navigate, openSettings]
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <main id="main-content" className="workspace-content thin-scrollbar">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
