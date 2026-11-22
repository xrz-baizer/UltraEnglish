import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Palette, Type as TypeIcon, Settings2, Volume2, Monitor } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'
import { MAX_WORD_REPEAT } from '@renderer/lib/vocabulary-repeat'
import { WORD_FONT_OPTIONS as wordFontOptions } from '@renderer/lib/vocabulary-typography'
import { Select } from '@renderer/components/ui/select'

const phoneticOptions = [
  { value: 'us', labelKey: 'settings.vocabulary.phoneticUs' },
  { value: 'uk', labelKey: 'settings.vocabulary.phoneticUk' },
  { value: 'close', labelKey: 'settings.vocabulary.phoneticClose' }
] as const

const voiceOptions = [
  { value: 'us', labelKey: 'settings.vocabulary.voiceUs' },
  { value: 'uk', labelKey: 'settings.vocabulary.voiceUk' },
  { value: 'close', labelKey: 'settings.vocabulary.voiceClose' }
] as const

function FontSizeControl({ labelKey, value, min, max, onChange }: {
  labelKey: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    const next = draft.trim() && Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{t(labelKey)}</span>
      <span className="flex shrink-0 items-center gap-2">
        <input type="number" min={min} max={max} step={1} aria-label={t(labelKey)} value={draft}
          className="glass-field w-20 rounded-lg border px-2 py-2 text-center text-sm tabular-nums"
          onChange={event => {
            setDraft(event.target.value)
            const next = Number(event.target.value)
            if (Number.isInteger(next) && next >= min && next <= max) onChange(next)
          }}
          onBlur={commit}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur() } }}
        />
        <span className="text-xs text-muted-foreground">px</span>
      </span>
    </label>
  )
}

export function VocabularySettings() {
  const { t } = useTranslation()
  const { settings, updateVocabularySettings, updateAudioSettings } = useSettingsStore()
  const { vocabulary, audio } = settings
  const resolvedWordFont = wordFontOptions.some((option) => option.value === vocabulary.wordFontFamily)
    ? vocabulary.wordFontFamily
    : wordFontOptions[0].value

  const Toggle = ({
    checked,
    label,
    onChange
  }: {
    checked: boolean
    label: string
    onChange: (checked: boolean) => void
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('glass-primary',
        'relative h-6 w-11 rounded-full transition-all duration-300',
        checked ? 'bg-primary shadow-inner shadow-primary/30' : 'bg-[hsl(var(--switch-track))] shadow-inner'
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[hsl(var(--switch-thumb))] shadow-md transition-all duration-300',
          checked && 'translate-x-5'
        )}
      />
    </button>
  )

  const sliderBackground = (value: number, min: number, max: number) => {
    const percent = ((value - min) / (max - min)) * 100
    return `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percent}%, hsl(var(--muted)) ${percent}%, hsl(var(--muted)) 100%)`
  }

  const FontWeightControl = ({
    labelKey,
    value,
    onChange
  }: {
    labelKey: string
    value: 400 | 500 | 600
    onChange: (value: 400 | 500 | 600) => void
  }) => (
    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
      <span className="text-sm font-medium">{t(labelKey)}</span>
      <div className="flex gap-1">
        {[400, 500, 600].map((weight) => (
          <button
            key={weight}
            onClick={() => onChange(weight as 400 | 500 | 600)}
            className={cn('glass-primary',
              'rounded-md px-2 py-1 text-xs font-medium transition-all',
              value === weight
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            {weight}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Behavior Section */}
      <div className="space-y-4">
        <div className="settings-group-heading flex items-center gap-2 border-b border-border/40 pb-2">
          <Settings2 className="h-5 w-5 text-primary-ink" />
          <h3 className="text-lg font-semibold">{t('settings.vocabulary.behavior', 'Practice Behavior')}</h3>
        </div>

        <div className="settings-panel settings-list grid gap-4 md:grid-cols-2">
          {/* Spelling Mode */}
          <div className="settings-row flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm md:col-span-2">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.spellingMode')}</label>

            </div>
            <div className="flex gap-2">
              {[
                { value: 'fill', labelKey: 'settings.vocabulary.spellingModeFill' },
                { value: 'dictation', labelKey: 'settings.vocabulary.spellingModeDictation' }
              ].map((option) => {
                const isActive = vocabulary.spellingMode === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      updateVocabularySettings({ spellingMode: option.value as 'fill' | 'dictation' })
                    }
                    className={cn('glass-primary',
                      'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {t(option.labelKey)}
                    {isActive && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Word Position */}
          {vocabulary.spellingMode === 'dictation' && (
            <div className="settings-row flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm md:col-span-2">
              <div>
                <label className="text-sm font-medium">{t('settings.vocabulary.wordPosition')}</label>

              </div>
              <div className="flex gap-2">
                {[
                  { value: 'top', labelKey: 'settings.vocabulary.wordPositionTop' },
                  { value: 'bottom', labelKey: 'settings.vocabulary.wordPositionBottom' }
                ].map((option) => {
                  const isActive = vocabulary.wordPosition === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() =>
                        updateVocabularySettings({ wordPosition: option.value as 'top' | 'bottom' })
                      }
                      className={cn('glass-primary',
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {t(option.labelKey)}
                      {isActive && <Check className="h-4 w-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Word Exercise Time */}
          <div className="settings-row rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">{t('settings.vocabulary.wordExerciseTime')}</label>

              </div>
              <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
                {vocabulary.wordExerciseTime}x
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={MAX_WORD_REPEAT}
              value={vocabulary.wordExerciseTime}
              onChange={(e) => updateVocabularySettings({ wordExerciseTime: parseInt(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              style={{
                background: sliderBackground(vocabulary.wordExerciseTime, 1, MAX_WORD_REPEAT)
              }}
            />
          </div>

          {/* Highlight Wrong Delay */}
          <div className="settings-row rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">{t('settings.vocabulary.highlightWrongDelay')}</label>

              </div>
              <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
                {vocabulary.highlightWrongDelay}ms
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={vocabulary.highlightWrongDelay}
              onChange={(e) => updateVocabularySettings({ highlightWrongDelay: parseInt(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              style={{
                background: sliderBackground(vocabulary.highlightWrongDelay, 100, 1000)
              }}
            />
          </div>

          {/* Random Order */}
          <div className="settings-row flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm md:col-span-2">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.randomOrder')}</label>

            </div>
            <Toggle
              label={t('settings.vocabulary.randomOrder')}
              checked={vocabulary.randomOrder}
              onChange={(checked) => updateVocabularySettings({ randomOrder: checked })}
            />
          </div>
        </div>
      </div>

      {/* Audio Section */}
      <div className="space-y-4">
        <div className="settings-group-heading flex items-center gap-2 border-b border-border/40 pb-2">
          <Volume2 className="h-5 w-5 text-primary-ink" />
          <h3 className="text-lg font-semibold">{t('settings.vocabulary.audio', 'Audio & Pronunciation')}</h3>
        </div>

        <div className="settings-panel settings-list grid gap-4 md:grid-cols-2">
          {/* Auto Pronunciation */}
          <div className="settings-row flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.autoPronounce')}</label>

            </div>
            <Toggle
              label={t('settings.vocabulary.autoPronounce')}
              checked={audio.autoPlaySound}
              onChange={(checked) => updateAudioSettings({ autoPlaySound: checked })}
            />
          </div>

          {/* Completion Sound */}
          <div className="settings-row flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.completionSound')}</label>

            </div>
            <Toggle
              label={t('settings.vocabulary.completionSound')}
              checked={vocabulary.completionSound}
              onChange={(checked) => updateVocabularySettings({ completionSound: checked })}
            />
          </div>

          {/* Voice Type */}
          <div className="settings-row flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm md:col-span-2">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.voiceType')}</label>

            </div>
            <div className="flex gap-2">
              {voiceOptions.map((option) => {
                const isActive = vocabulary.voiceType === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      updateVocabularySettings({ voiceType: option.value as 'us' | 'uk' | 'close' })
                    }
                    className={cn('glass-primary',
                      'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {t(option.labelKey)}
                    {isActive && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Phonetic */}
          <div className="settings-row flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm md:col-span-2">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.phonetic')}</label>

            </div>
            <div className="flex gap-2">
              {phoneticOptions.map((option) => {
                const isActive = vocabulary.phonetic === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      updateVocabularySettings({ phonetic: option.value as 'us' | 'uk' | 'close' })
                    }
                    className={cn('glass-primary',
                      'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {t(option.labelKey)}
                    {isActive && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="space-y-4">
        <div className="settings-group-heading flex items-center gap-2 border-b border-border/40 pb-2">
          <Monitor className="h-5 w-5 text-primary-ink" />
          <h3 className="text-lg font-semibold">{t('settings.vocabulary.display', 'Display Settings')}</h3>
        </div>

        <div className="settings-panel settings-list grid gap-4 md:grid-cols-2">
          {/* Show Translation */}
          <div className="settings-row flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div>
              <label className="text-sm font-medium">{t('settings.vocabulary.showTranslation')}</label>

            </div>
            <Toggle
              label={t('settings.vocabulary.showTranslation')}
              checked={vocabulary.showTranslation}
              onChange={(checked) =>
                updateVocabularySettings({
                  showTranslation: checked,
                  autoShowTranslationOnInput: checked ? false : vocabulary.autoShowTranslationOnInput
                })
              }
            />
          </div>

          {/* Auto Show Translation */}
          <div className="settings-row flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div>
              <label className="text-sm font-medium">
                {t('settings.vocabulary.autoShowTranslationOnInput')}
              </label>

            </div>
            <Toggle
              label={t('settings.vocabulary.autoShowTranslationOnInput')}
              checked={vocabulary.autoShowTranslationOnInput}
              onChange={(checked) =>
                updateVocabularySettings({
                  autoShowTranslationOnInput: checked,
                  showTranslation: checked ? false : vocabulary.showTranslation
                })
              }
            />
          </div>

          {/* One place for spelling typography, shared by fill and dictation. */}
          <section className="settings-row spelling-font-settings flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 md:col-span-2" aria-label={t('settings.vocabulary.spellingFont')}>
            <h4 className="text-sm font-semibold">{t('settings.vocabulary.spellingFont')}</h4>
            <label className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('settings.vocabulary.wordFont')}</span>
              <Select
                label={t('settings.vocabulary.wordFont')}
                value={resolvedWordFont}
                onValueChange={(wordFontFamily) => void updateVocabularySettings({ wordFontFamily })}
                options={wordFontOptions.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
              />
            </label>
            <label className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
              <span className="text-sm font-medium">{t('settings.vocabulary.wordFontBold')}</span>
              <Select
                label={t('settings.vocabulary.wordFontBold')}
                value={String(vocabulary.wordFontWeight)}
                onValueChange={(value) => void updateVocabularySettings({ wordFontWeight: Number(value) as 400 | 500 | 600 | 700 })}
                options={[
                  { value: '400', label: t('settings.audio.regular') },
                  { value: '500', label: '500' },
                  { value: '600', label: '600' },
                  { value: '700', label: t('settings.audio.bold') }
                ]}
              />
            </label>
            <div className="grid gap-6 sm:grid-cols-2">
              <FontSizeControl
                labelKey="settings.vocabulary.wordFontSize"
                value={vocabulary.wordFontSize}
                min={24}
                max={72}
                onChange={(value) => updateVocabularySettings({ wordFontSize: value })}
              />
              <FontSizeControl
                labelKey="settings.vocabulary.phoneticFontSize"
                value={vocabulary.phoneticFontSize}
                min={12}
                max={32}
                onChange={(value) => updateVocabularySettings({ phoneticFontSize: value })}
              />
              <FontSizeControl
                labelKey="settings.vocabulary.definitionFontSize"
                value={vocabulary.definitionFontSize}
                min={12}
                max={72}
                onChange={(value) => updateVocabularySettings({ definitionFontSize: value })}
              />
              <FontSizeControl
                labelKey="settings.vocabulary.examplesFontSize"
                value={vocabulary.examplesFontSize}
                min={12}
                max={72}
                onChange={(value) => updateVocabularySettings({ examplesFontSize: value })}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Visual Settings - Redesigned */}
      <div className="space-y-4">
        <div className="settings-group-heading flex items-center gap-2 border-b border-border/40 pb-2">
          <Palette className="h-5 w-5 text-primary-ink" />
          <h3 className="text-lg font-semibold">{t('settings.vocabulary.visualStyle')}</h3>
        </div>

        <div className="settings-panel settings-list grid gap-6 md:grid-cols-2">
          {/* Typography Card */}
          <div className="settings-row rounded-xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-muted-foreground">
              <TypeIcon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{t('settings.vocabulary.visualStyle')} - Typography</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <span className="text-sm font-medium">{t('settings.vocabulary.highlightKeywordsInExamples')}</span>
                <Toggle
                  label={t('settings.vocabulary.highlightKeywordsInExamples')}
                  checked={vocabulary.highlightKeywordsInExamples}
                  onChange={(checked) => updateVocabularySettings({ highlightKeywordsInExamples: checked })}
                />
              </div>


              <FontWeightControl
                labelKey="settings.vocabulary.definitionFontBold"
                value={vocabulary.definitionFontWeight}
                onChange={(value) => updateVocabularySettings({ definitionFontWeight: value })}
              />

              <FontWeightControl
                labelKey="settings.vocabulary.examplesFontBold"
                value={vocabulary.examplesFontWeight}
                onChange={(value) => updateVocabularySettings({ examplesFontWeight: value })}
              />
            </div>
          </div>

          {/* Colors Card */}
          <div className="settings-row rounded-xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{t('settings.vocabulary.visualStyle')} - Colors</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { label: t('settings.vocabulary.correctColor'), key: 'correctColor' as const },
                { label: t('settings.vocabulary.wrongColor'), key: 'wrongColor' as const },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <label htmlFor={`${item.key}-hex`} className="text-sm font-medium text-foreground">{item.label}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      id={`${item.key}-hex`}
                      value={vocabulary[item.key] as string}
                      onChange={(e) => updateVocabularySettings({ [item.key]: e.target.value })}
                      className="glass-field h-8 w-24 rounded-md border px-2 text-xs font-mono uppercase shadow-sm focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      placeholder="#000000"
                    />
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border border-border shadow-sm transition-transform hover:scale-105">
                      <input
                        type="color"
                        aria-label={item.label}
                        value={vocabulary[item.key] as string}
                        onChange={(e) => updateVocabularySettings({ [item.key]: e.target.value })}
                        className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
