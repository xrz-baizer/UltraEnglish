import { PanelLeft, ChevronLeft, BookOpen, Headphones, LayoutGrid, AudioLines } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function TitleBar({
  collapsed,
  onToggleSidebar,
  scrolled
}: {
  collapsed: boolean
  onToggleSidebar: () => void
  scrolled: boolean
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const section = pathname.startsWith('/vocabulary')
    ? 'vocabulary'
    : pathname.startsWith('/audios')
      ? 'audios'
      : pathname === '/audio-generation' ? 'generation' : 'overview'
  const Icon = { vocabulary: BookOpen, audios: Headphones, generation: AudioLines, overview: LayoutGrid }[section]
  const isDetail = pathname.split('/').filter(Boolean).length > 1
  return (
    <header className={`workspace-toolbar drag-region ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="toolbar-leading no-drag">
        <button
          className="icon-button"
          aria-label={t(collapsed ? 'shell.expandSidebar' : 'shell.collapseSidebar')}
          aria-expanded={!collapsed}
          onClick={onToggleSidebar}
        >
          <PanelLeft size={19} strokeWidth={1.7} />
        </button>
        {isDetail && (
          <button
            className="icon-button"
            aria-label={t('common.back')}
            onClick={() => navigate(`/${section}`)}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <span className="toolbar-divider" />
        <Icon size={16} className="text-muted-foreground" aria-hidden="true" />
        <span className="toolbar-title">{t(section === 'generation' ? 'audioGeneration.title' : `shell.${section}`)}</span>
      </div>

    </header>
  )
}
