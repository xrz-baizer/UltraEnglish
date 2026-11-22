import { useLayoutEffect, useRef } from 'react'
import logo from '../../../../assets/icons/brand/ultra-english-v1/ultra-english-mark.svg?no-inline'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Headphones,
  Settings,
  AudioLines,
  House
} from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings-store'

const items = [
  { title: 'shell.overview', href: '/', icon: House },
  { title: 'audioGeneration.title', href: '/audio-generation', icon: AudioLines },
  { title: 'shell.audios', href: '/audios', icon: Headphones },
  { title: 'shell.vocabulary', href: '/vocabulary', icon: BookOpen }
]

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t, i18n } = useTranslation()
  const sidebarRef = useRef<HTMLElement>(null)
  const fontScale = useSettingsStore((state) => state.settings.basic.fontScale)
  useLayoutEffect(() => {
    const aside = sidebarRef.current
    if (!aside || collapsed) return
    const measure = () => {
      let width = 168
      aside
        .querySelectorAll<HTMLElement>('.sidebar-link, .sidebar-brand')
        .forEach((row) => {
          const style = getComputedStyle(row)
          let required =
            parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
          const children = Array.from(row.children) as HTMLElement[]
          children.forEach((child) => {
            const text = child.textContent?.trim()
            if (text) {
              // Measure the rendered glyphs, including fallback Chinese/system fonts.
              required += Math.max(child.scrollWidth, child.getBoundingClientRect().width)
            } else required += child.getBoundingClientRect().width
          })
          required +=
            Math.max(0, children.length - 1) *
            (parseFloat(style.columnGap) || 0)
          const parent = getComputedStyle(row.parentElement!)
          width = Math.max(
            width,
            required +
              (parseFloat(parent.paddingLeft) || 0) +
              (parseFloat(parent.paddingRight) || 0) +
              8
          )
        })
      aside
        .closest<HTMLElement>('.app-shell')
        ?.style.setProperty('--sidebar-width', `${Math.ceil(width)}px`)
    }
    measure()
    let disposed = false
    void document.fonts.ready.then(() => {
      if (!disposed) measure()
    })
    const resizeObserver = new ResizeObserver(measure)
    aside.querySelectorAll('.sidebar-link span').forEach((label) => resizeObserver.observe(label))
    const observer = new MutationObserver(measure)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class']
    })
    return () => {
      disposed = true
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [collapsed, i18n.language, fontScale])
  const openSettings = useSettingsStore((state) => state.setOpen)

  return (
    <aside
      ref={sidebarRef}
      id="workspace-sidebar"
      className="app-sidebar"
      aria-label={t('shell.navigation')}
    >
      <div className="sidebar-window-space drag-region" aria-hidden="true" />
      <div className="sidebar-brand drag-region" title="UltraEnglish">
        <img className="sidebar-brand-icon" src={logo} alt={collapsed ? 'UltraEnglish' : ''} />
        {!collapsed && <div className="sidebar-brand-copy"><strong>UltraEnglish</strong><span>{t('shell.studyWorkspace')}</span></div>}
      </div>
      <nav className="sidebar-navigation" aria-label={t('shell.library')}>
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            title={t(item.title)}
            aria-label={t(item.title)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'is-active' : ''}`
            }
          >
            <item.icon size={19} strokeWidth={1.7} aria-hidden="true" />
            {!collapsed && (
              <>
                <span>{t(item.title)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="sidebar-link"
          onClick={() => openSettings(true)}
          title={t('nav.settings')}
          aria-label={t('nav.settings')}
        >
          <Settings size={19} strokeWidth={1.7} aria-hidden="true" />
          {!collapsed && (
            <>
              <span>{t('nav.settings')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
