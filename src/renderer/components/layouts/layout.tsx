import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './sidebar'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function Layout() {
  const { t } = useTranslation()
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

  const toggleSidebar = () => setCollapsed((value) => !value)
  const sidebarToggleLabel = t(collapsed ? 'shell.expandSidebar' : 'shell.collapseSidebar')
  const SidebarToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar collapsed={collapsed} />
      <div className="app-workspace">
        <div className="workspace-window-bar drag-region">
          <button
            type="button"
            className="icon-button workspace-sidebar-toggle no-drag"
            title={sidebarToggleLabel}
            aria-label={sidebarToggleLabel}
            aria-controls="workspace-sidebar"
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
          >
            <SidebarToggleIcon size={19} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
        <main id="main-content" className="workspace-content thin-scrollbar">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
