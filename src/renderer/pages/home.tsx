import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, AudioLines, FileText, Headphones, Keyboard, LibraryBig, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LearningOverview } from '../../shared/app-commands'

const GENERATION_WAVE = [8, 12, 17, 27, 18, 11, 22, 34, 49, 62, 46, 31, 19, 28, 43, 56, 42, 28, 18, 11, 6]
const SHADOWING_WAVE = [8, 17, 29, 48, 64, 45, 29, 17, 12, 24, 39, 58, 70, 54, 37, 25, 33, 48, 32, 18, 8]
const KEY_ROWS = ['QWER', 'ASDF', 'ZXC']

function AudioIllustration({ icon: Icon, wave }: { icon: LucideIcon; wave: number[] }) {
  return (
    <svg viewBox="0 0 216 112" aria-hidden="true">
      <Icon x={10} y={30} size={52} strokeWidth={1.25} />
      <g className="overview-art-wave" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
        {wave.map((height, index) => {
          const x = 76 + index * 6.2
          return (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={56 - height / 2}
              y2={56 + height / 2}
              style={{ animationDelay: `${index * 24}ms` }}
            />
          )
        })}
      </g>
    </svg>
  )
}

function KeyboardIllustration() {
  return (
    <svg viewBox="0 0 216 112" aria-hidden="true">
      {KEY_ROWS.flatMap((row, rowIndex) => Array.from(row, (letter, column) => {
        const x = 24 + rowIndex * 7 + column * 43
        const y = 12 + rowIndex * 30
        return (
          <g className="overview-art-key" key={letter} style={{ animationDelay: `${(rowIndex * 4 + column) * 46}ms` }}>
            <rect className="overview-art-key-edge" x={x} y={y + 3} width={37} height={24} rx={5} />
            <rect className="overview-art-key-face" x={x} y={y} width={37} height={24} rx={5} />
            <text x={x + 18.5} y={y + 12} textAnchor="middle" dominantBaseline="central">{letter}</text>
          </g>
        )
      }))}
    </svg>
  )
}

const HOME_FEATURES = [
  {
    to: '/audio-generation',
    illustration: <AudioIllustration icon={FileText} wave={GENERATION_WAVE} />,
    title: 'audioGeneration.title',
    description: 'home.generationDescription'
  },
  {
    to: '/audios',
    illustration: <AudioIllustration icon={Headphones} wave={SHADOWING_WAVE} />,
    title: 'design.shadowingPractice',
    description: 'home.shadowingDescription'
  },
  {
    to: '/vocabulary',
    illustration: <KeyboardIllustration />,
    title: 'design.spellingPractice',
    description: 'home.spellingDescription'
  }
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

  return (
    <div className="content-container home-page">
      <header className="library-heading">
        <div className="page-heading">
          <h1>{t('shell.overview')}</h1>
        </div>
      </header>
      <div className="overview-entry-list">
        {HOME_FEATURES.map(({ to, illustration, title, description }) => (
          <Link key={to} to={to} className="overview-feature surface-panel">
            <div className="overview-feature-art">{illustration}</div>
            <div className="overview-feature-copy">
              <h2>{t(title)}</h2>
              <p>{t(description)}</p>
            </div>
            <ArrowRight className="overview-feature-arrow" size={19} aria-hidden="true" />
          </Link>
        ))}
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {t('design.loadError')}
          <button type="button" className="text-button" onClick={loadOverview}>
            <RotateCcw size={14} aria-hidden="true" />
            {t('common.retry')}
          </button>
        </div>
      )}
      <section
        className="overview-progress-panel surface-panel"
        aria-labelledby="overview-progress-title"
        aria-busy={!overview && !error}
      >
        <h2 id="overview-progress-title">{t('home.yourProgress')}</h2>
        <ul className="overview-metrics" role="list">
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
            <li className="overview-metric" key={metric.label}>
              <span className="overview-metric-icon" aria-hidden="true">
                <metric.icon size={20} strokeWidth={1.6} />
              </span>
              <div className="overview-metric-copy">
                <span>{t(metric.label)}</span>
                <strong>
                  {metric.value === undefined ? '—' : metric.value.toLocaleString(i18n.language)}
                </strong>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
