import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../i18n'
import { cn } from '../lib/utils'

const languages = [
  { code: 'zh-CN', nameKey: 'settings.languages.zhCN' },
  { code: 'en', nameKey: 'settings.languages.en' }
]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const currentLang = getCurrentLanguage()

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode)
  }

  return (
    <div className="flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          className={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200',
            currentLang === lang.code || i18n.language === lang.code
              ? 'border-primary bg-primary/10 text-primary-ink shadow-sm'
              : 'border-border bg-background hover:bg-muted hover:border-muted-foreground/30'
          )}
        >
          {t(lang.nameKey)}
        </button>
      ))}
    </div>
  )
}
