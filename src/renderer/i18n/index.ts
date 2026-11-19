import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'

const LANGUAGE_KEY = 'ultra-english-language'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      en: { translation: en }
    },
    fallbackLng: 'zh-CN',
    lng: localStorage.getItem(LANGUAGE_KEY) || 'zh-CN',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANGUAGE_KEY,
      caches: ['localStorage']
    }
  })

export const changeLanguage = (lang: string) => {
  localStorage.setItem(LANGUAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export const getCurrentLanguage = () => {
  return i18n.language || 'zh-CN'
}

export default i18n
