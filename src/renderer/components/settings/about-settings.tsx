import logo from '../../../../assets/icons/icon.png'
import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleHelp, Github, Globe, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_LINKS } from '../../../shared/app-links'
import { SettingsGroup } from './settings-group'

const links = [
  { url: APP_LINKS.website, icon: Globe, label: 'settings.about.website' },
  { url: APP_LINKS.github, icon: Github, label: 'settings.about.github' },
  { url: APP_LINKS.issues, icon: CircleHelp, label: 'settings.about.issues' }
]

export function AboutSettings() {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string | null>()

  useEffect(() => {
    let active = true
    void window.electronAPI.getAppVersion().then(
      (value) => { if (active) setVersion(value) },
      () => { if (active) setVersion(null) }
    )
    return () => { active = false }
  }, [])

  return (
    <div className="space-y-8">
      <div className="grid justify-items-center gap-2 py-4 text-center">
        <img src={logo} alt="" className="h-20 w-20 object-contain" />
        <h4 className="text-xl font-semibold">UltraEnglish</h4>
        <p role="status" className="select-text break-all text-sm tabular-nums text-muted-foreground">
          {version === undefined
            ? t('common.loading')
            : version === null
              ? t('settings.about.versionUnavailable')
              : t('settings.about.version', { version })}
        </p>
      </div>

      <SettingsGroup icon={Link2} title={t('settings.about.links')}>
        {links.map(({ url, icon: Icon, label }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-row group flex min-h-11 items-center gap-3 p-4 text-sm font-medium hover:text-primary-ink focus-visible:outline-offset-[-3px]"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 group-hover:underline">{t(label)}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        ))}
      </SettingsGroup>
    </div>
  )
}
