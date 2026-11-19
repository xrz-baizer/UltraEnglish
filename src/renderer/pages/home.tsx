import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, AudioLines, BookOpen, Headphones, Keyboard, LibraryBig, RotateCcw } from 'lucide-react'
import type { LearningOverview } from '../../shared/app-commands'

const WAVE_HEIGHTS = [
  10, 16, 27, 43, 32, 55, 76, 62, 39, 24, 17, 30, 49, 74, 93, 68,
  47, 35, 52, 69, 45, 28, 17, 25, 47, 66, 84, 63, 44, 30, 18, 9
]

export function HomePage() {
  const { t, i18n } = useTranslation()
  const mounted = useRef(true)
  const [overview, setOverview] = useState<LearningOverview | null>(null)
  const [error, setError] = useState(false)
  const loadOverview = useCallback(async () => {
    if (!mounted.current) return
    setError(false)
    try {
      const data = await window.electronAPI.getLearningOverview()
      if (mounted.current) setOverview(data)
    } catch {
      if (mounted.current) setError(true)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    void loadOverview()
    const refresh = () => {
      void loadOverview()
    }
    const unsubscribers = ['vocabulary-books-updated', 'word-progress-updated'].map((channel) =>
      window.electronAPI.on(channel, refresh)
    )
    return () => {
      mounted.current = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [loadOverview])

  const featured = overview?.featuredBook
  return (
    <div className="content-container home-page">
      <div className="page-heading">
        <h1>{t('shell.overview')}</h1>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {t('design.loadError')}
          <button className="text-button" onClick={loadOverview}>
            <RotateCcw size={14} />
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="overview-entry-grid">
        <section className="learning-feature surface-panel" aria-labelledby="continue-title">
          <div className="feature-copy">
            <h2 id="continue-title">{t('design.spellingPractice')}</h2>
            <div className="feature-actions">
              <NavLink
                to={featured ? `/vocabulary/${featured.id}` : '/vocabulary'}
                className="primary-button"
              >
                {t(featured ? 'design.openBook' : 'design.exploreBooks')}
                <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </NavLink>
            </div>
          </div>
          <div className="overview-art" aria-hidden="true">
            <BookOpen className="overview-book-art" strokeWidth={1.15} />
            <div className="overview-keyboard">
              {['QWER', 'ASDF', 'ZXC'].map((row, rowIndex) => (
                <div className="overview-key-row" key={row}>
                  {Array.from(row, (letter, column) => (
                    <span key={letter} style={{ animationDelay: (rowIndex * 4 + column) * 65 + 'ms' }}>
                      {letter}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="learning-feature surface-panel" aria-labelledby="audio-title">
          <div className="feature-copy">
            <h2 id="audio-title">{t('design.shadowingPractice')}</h2>
            <div className="feature-actions">
              <NavLink to="/audios" className="primary-button">
                {t('design.openAudioLibrary')}
                <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </NavLink>
            </div>
          </div>
          <div className="overview-art" aria-hidden="true">
            <Headphones className="overview-headphones" strokeWidth={1.25} />
            <div className="overview-wave">
              {WAVE_HEIGHTS.map((height, index) => (
                <span key={index} style={{ height: height + '%', animationDelay: -(index % 7) * 0.19 + 's' }} />
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="overview-progress-panel surface-panel">
        <h2 className="overview-progress-title">{t('home.yourProgress')}</h2>
        <section
          className="overview-metrics"
          aria-label={t('home.yourProgress')}
          aria-busy={!overview && !error}
        >
          {[
            {
              value: overview?.practicedWords,
              icon: Keyboard,
              label: 'design.practicedWords'
            },
            {
              value: overview?.booksCount,
              icon: LibraryBig,
              label: 'design.booksInLibrary'
            },
            {
              value: overview?.audiosCount,
              icon: AudioLines,
              label: 'design.audioResources'
            }
          ].map((metric) => (
            <div className="overview-metric" key={metric.label}>
              <span><metric.icon size={16} strokeWidth={1.5} aria-hidden="true" />{t(metric.label)}</span>
              <strong>
                {metric.value === undefined ? '—' : metric.value.toLocaleString(i18n.language)}
              </strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
