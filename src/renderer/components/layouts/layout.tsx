import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function Layout() {
  const navigate = useNavigate()
  const openSettings = useSettingsStore((state) => state.setOpen)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])
  useEffect(
    () =>
      window.electronAPI.onAppCommand((command) => {
        if (command === 'settings') openSettings(true)
        else if (command === 'toggle-sidebar') setCollapsed((value) => !value)
        else
          navigate(
            { home: '/', vocabulary: '/vocabulary', audios: '/audios' }[command]
          )
      }),
    [navigate, openSettings]
  )

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <div className="app-workspace">
        <div className="workspace-drag-strip drag-region" aria-hidden="true"/>
        <main id="main-content" className="workspace-content thin-scrollbar">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
