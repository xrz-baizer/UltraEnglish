import { useEffect, useRef, useState } from 'react'
import { AudioLines, History, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AudioGenerationDownloadStatus } from '@renderer/components/audio-generation-download-status'
import { AudioGenerationProgressDialog } from '@renderer/components/audio-generation-progress-dialog'
import { useAudioGenerationResources } from '@renderer/hooks/use-audio-generation-resources'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { Select } from '@renderer/components/ui/select'
import {
  DEFAULT_GENERATION_OPTIONS, GENERATION_FORMATS, GENERATION_QUALITIES, GENERATION_VOICES,
  MAX_GENERATION_SPEED, MAX_GENERATION_TEXT_LENGTH, MIN_GENERATION_SPEED, isGenerationFormat, validateGenerationText
} from '../../shared/audio-generation'
import type { GeneratedAudio, GenerationOptions, GenerationState, GenerationVoice } from '../../shared/audio-generation'
import { AudioGenerationResult } from './audio-generation-result'
import { AudioGenerationResourceMenu } from './audio-generation-resource-menu'
import { AudioGenerationHistory } from './audio-generation-history'
import { AudioGenerationSaveDialog } from './audio-generation-save-dialog'

const api = () => window.electronAPI

const FONT_SIZE_KEY = 'audio-generation-input-font-size'
const DEFAULT_FONT_SIZE = 24
const MIN_FONT_SIZE = 14
const MAX_FONT_SIZE = 32
const VOICES = Object.keys(GENERATION_VOICES) as GenerationVoice[]

function readFontSize() {
  const value = Number(localStorage.getItem(FONT_SIZE_KEY))
  return Number.isInteger(value) && value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE ? value : DEFAULT_FONT_SIZE
}

interface GenerationStepperProps {
  kind: 'speed' | 'font'
  display: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onStep: (direction: -1 | 1) => void
}

function GenerationStepper({ kind, display, value, min, max, disabled, onStep }: GenerationStepperProps) {
  const { t } = useTranslation()
  const label = (action: 'smaller' | 'larger') => t(`audioGeneration.${kind}.${action}`)
  const title = t(`audioGeneration.${kind}.label`)
  return (
    <div className={kind === 'font' ? 'audio-generation-font-size' : 'audio-generation-option'}>
      <span>{title}</span>
      <div className={kind === 'font' ? 'audio-generation-font-stepper' : 'audio-generation-stepper'} role="group" aria-label={title}>
        <button type="button" className="icon-button" title={label('smaller')}
          aria-label={label('smaller')} disabled={disabled || value <= min} onClick={() => onStep(-1)}>
          <Minus size={kind === 'font' ? 12 : 15} aria-hidden="true" />
        </button>
        <output>{display}</output>
        <button type="button" className="icon-button" title={label('larger')}
          aria-label={label('larger')} disabled={disabled || value >= max} onClick={() => onStep(1)}>
          <Plus size={kind === 'font' ? 12 : 15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function AudioGenerationPage() {
  const { t, i18n } = useTranslation()
  const [input, setInput] = useState('')
  const [outputOptions, setOutputOptions] = useState({
    format: DEFAULT_GENERATION_OPTIONS.format,
    speed: DEFAULT_GENERATION_OPTIONS.speed
  })
  const [fontSize, setFontSize] = useState(readFontSize)
  const [state, setState] = useState<GenerationState>({ stage: 'idle' })
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<GeneratedAudio>()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const historyTrigger = useRef<HTMLButtonElement>(null)
  const modelTrigger = useRef<HTMLButtonElement>(null)
  const voiceTrigger = useRef<HTMLButtonElement>(null)
  const resultTrigger = useRef<HTMLButtonElement | null>(null)
  const { resources, download, fault, refresh, startDownload } = useAudioGenerationResources()
  const { quality, voice } = useSettingsStore((settings) => settings.settings.audioGeneration)
  const updateResourceSettings = useSettingsStore((settings) => settings.updateAudioGenerationSettings)
  const settingsLoading = useSettingsStore((settings) => settings.isLoading)
  const settingsOpen = useSettingsStore((settings) => settings.isOpen)
  const setOpen = useSettingsStore((settings) => settings.setOpen)
  const setActiveCategory = useSettingsStore((settings) => settings.setActiveCategory)
  const options: GenerationOptions = { ...outputOptions, quality, voice }

  useEffect(() => {
    let active = true
    let changed = false
    const unsubscribe = api().onAudioGenerationProgress((next) => {
      changed = true
      setState(next)
      if (next.stage === 'ready') {
        resultTrigger.current = trigger.current
        setResult(next.result)
        setHistoryOpen(false)
      }
    })
    void api().getAudioGenerationState().then((snapshot) => {
      if (!active) return
      if (!changed) setState(snapshot.state)
      setInput(snapshot.text)
      setOutputOptions({ format: snapshot.options.format, speed: snapshot.options.speed })
    }).catch(() => {
      if (active) setError(true)
    }).finally(() => {
      if (active) setInitializing(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (state.stage !== 'needs-resources' || submitting || initializing || settingsLoading || settingsOpen) return
    if (state.ids.includes(quality)) modelTrigger.current?.focus()
    else if (state.ids.includes(voice)) voiceTrigger.current?.focus()
    void refresh()
  }, [state, quality, voice, submitting, initializing, settingsLoading, settingsOpen, refresh])

  const busy = ['checking', 'generating', 'encoding', 'saving'].includes(state.stage)
  const controlsDisabled = initializing || busy || submitting || settingsLoading
  const validation = validateGenerationText(input)
  const invalid = validation && validation !== 'empty'
  const missingIds = state.stage === 'needs-resources'
    ? state.ids.filter((id) => !resources?.some((resource) => resource.id === id && resource.ready))
    : []
  const needsModel = missingIds.includes(options.quality)
  const needsVoice = missingIds.includes(options.voice)
  const resourceError = needsModel && needsVoice ? 'requiredBoth' : needsModel ? 'requiredModel' : 'requiredVoice'
  const countFormat = new Intl.NumberFormat(i18n.language)

  const submit = async (operation: () => Promise<void>) => {
    setSubmitting(true)
    setError(false)
    try {
      await operation()
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const prepareSave = async () => {
    const snapshot = await api().getAudioGenerationResources()
    const ids = snapshot.resources
      .filter((resource) => (resource.id === options.quality || resource.id === options.voice) && !resource.ready)
      .map((resource) => resource.id)
    if (ids.length) {
      setState({ stage: 'needs-resources', ids })
    } else {
      setState((current) => current.stage === 'needs-resources' ? { stage: 'idle' } : current)
      setSaveOpen(true)
    }
  }

  const changeFontSize = (step: number) => {
    const next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize + step))
    setFontSize(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

  const changeResources = (selection: Partial<Pick<GenerationOptions, 'quality' | 'voice'>>) => {
    void updateResourceSettings(selection)
    setState((current) => current.stage === 'needs-resources' ? { stage: 'idle' } : current)
  }

  const openSettings = () => {
    setActiveCategory('audio-generation')
    setOpen(true)
  }
  return (
    <div className="content-container audio-generation-page">
      <header className="library-heading drag-region">
        <div className="page-heading">
          <h1>{t('shell.generation')}</h1>
        </div>
      </header>
      <form className="audio-generation-form" onSubmit={(event) => {
        event.preventDefault()
        if (!validation && !controlsDisabled) void submit(prepareSave)
      }}>
        <div className="audio-generation-toolbar">
          <AudioGenerationResourceMenu
            kind="quality"
            ids={GENERATION_QUALITIES}
            selected={options.quality}
            label={(id) => t(`audioGeneration.options.qualities.${id}`)}
            resources={resources}
            triggerRef={modelTrigger}
            disabled={controlsDisabled}
            downloading={!!download}
            invalid={needsModel}
            onValueChange={(quality) => changeResources({ quality })}
            onDownload={(id) => void startDownload([id])}
          />
          <AudioGenerationResourceMenu
            kind="voice"
            ids={VOICES}
            selected={options.voice}
            label={(id) => t(`audioGeneration.options.voices.${id}`)}
            resources={resources}
            triggerRef={voiceTrigger}
            disabled={controlsDisabled}
            downloading={!!download}
            invalid={needsVoice}
            onValueChange={(voice) => changeResources({ voice })}
            onDownload={(id) => void startDownload([id])}
          />
          <div className="audio-generation-option">
            <span>{t('audioGeneration.options.format')}</span>
            <Select
              label={t('audioGeneration.options.format')}
              value={options.format}
              options={GENERATION_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() }))}
              disabled={controlsDisabled}
              onValueChange={(format) => {
                if (isGenerationFormat(format)) setOutputOptions((current) => ({ ...current, format }))
              }}
            />
          </div>
          <GenerationStepper kind="speed" display={`${countFormat.format(options.speed)}×`}
            value={options.speed} min={MIN_GENERATION_SPEED} max={MAX_GENERATION_SPEED}
            disabled={controlsDisabled}
            onStep={(direction) => setOutputOptions((current) => ({
              ...current, speed: (Math.round(current.speed * 10) + direction) / 10
            }))} />
          <div className="audio-generation-toolbar-actions no-drag">
            <button ref={historyTrigger} type="button" className="text-button audio-generation-history-button"
              aria-label={t('audioGeneration.history.open')} title={t('audioGeneration.history.open')}
              onClick={() => setHistoryOpen(true)}>
              <History size={16} aria-hidden="true" />
              {t('audioGeneration.history.title')}
            </button>
            <button ref={trigger} type="submit" className="primary-button audio-generation-submit"
              disabled={controlsDisabled || !!validation}>
              <AudioLines size={17} aria-hidden="true" />
              {t('audioGeneration.generate')}
            </button>
          </div>
        </div>
        <div className="audio-generation-feedback">
          {(needsModel || needsVoice) && !download && (
            <p id="generation-resources-error" className="inline-error" role="alert">
              {t(`audioGeneration.model.${resourceError}`)}
            </p>
          )}
          {fault && (
            <div className="inline-error" role="alert">
              {t(fault === 'load' ? 'audioGeneration.errors.resources' : 'audioGeneration.errors.download')}
              {fault === 'load' && <button type="button" className="text-button" onClick={() => void refresh()}>{t('common.retry')}</button>}
            </div>
          )}
          {(state.stage === 'save-failed' || state.stage === 'encode-failed') && (
            <div className="audio-generation-actions">
              <button type="button" className="secondary-button" disabled={submitting} onClick={() => void submit(() => api().retryGeneratedAudioSave())}>
                {t(state.stage === 'encode-failed' ? 'audioGeneration.retryMp3' : 'audioGeneration.retrySave')}
              </button>
              {state.stage === 'save-failed' && (
                <button type="button" className="text-button" disabled={submitting}
                  onClick={() => void submit(async () => {
                    const location = await api().chooseAudioGenerationSaveLocation()
                    if (location) await api().retryGeneratedAudioSave(undefined, location.token)
                  })}>
                  {t('audioGeneration.settings.choose')}
                </button>
              )}
              {state.stage === 'encode-failed' && (
                <button type="button" className="secondary-button" disabled={submitting}
                  onClick={() => void submit(() => api().retryGeneratedAudioSave('wav'))}>
                  {t('audioGeneration.saveAsWav')}
                </button>
              )}
            </div>
          )}
          {state.stage === 'encode-failed' && <p className="inline-error" role="alert">{t(`audioGeneration.errors.${state.reason}`)}</p>}
          {(error || state.stage === 'failed' || state.stage === 'save-failed') && (
            <div className="inline-error" role="alert">
              {t(error ? 'audioGeneration.errors.operation' : state.stage === 'failed'
                ? `audioGeneration.errors.${state.reason}` : 'audioGeneration.errors.save')}
              {(state.stage === 'save-failed' || state.stage === 'failed') && state.detail && (
                <div className="basis-full break-all text-sm">{state.detail}</div>
              )}
              {(state.stage === 'save-failed' || (state.stage === 'failed' && state.reason === 'model-directory')) && (
                <button type="button" className="text-button" onClick={openSettings}>
                  {t('nav.settings')}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="surface-panel audio-generation-editor no-drag">
          <label htmlFor="generation-input" className="sr-only">{t('audioGeneration.input')}</label>
          <textarea
            id="generation-input"
            className="no-drag"
            rows={6}
            lang="en"
            style={{ fontSize }}
            value={input}
            readOnly={busy || initializing}
            aria-invalid={!!invalid}
            aria-describedby={`generation-count${invalid ? ' generation-error' : ''}`}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('audioGeneration.placeholder')}
          />
          <div className="audio-generation-editor-meta audio-generation-input-footer">
            <GenerationStepper kind="font" display={`${countFormat.format(fontSize)} px`}
              value={fontSize} min={MIN_FONT_SIZE} max={MAX_FONT_SIZE}
              onStep={(direction) => changeFontSize(direction * 2)} />
            <p id="generation-count" className="text-right text-sm tabular-nums text-muted-foreground">
              {t('audioGeneration.count', { current: countFormat.format(input.length), max: countFormat.format(MAX_GENERATION_TEXT_LENGTH) })}
            </p>
          </div>
          {invalid && <p className="inline-error" role="alert" id="generation-error">{t(`audioGeneration.errors.${validation}`)}</p>}
        </div>
      </form>

      {busy ? (
        <AudioGenerationProgressDialog
          title={t(`audioGeneration.${state.stage}`)}
          detail={state.stage === 'generating' && state.total ? t('audioGeneration.generatingProgress', state) : undefined}
          onCloseAutoFocus={() => trigger.current?.focus()}
        />
      ) : download && !settingsOpen && (
        <AudioGenerationDownloadStatus download={download} onCloseAutoFocus={() => {
          const target = download.ids.includes(options.voice) ? voiceTrigger : modelTrigger
          target.current?.focus()
        }} />
      )}
      {historyOpen && (
        <AudioGenerationHistory onClose={() => {
          setHistoryOpen(false)
          requestAnimationFrame(() => historyTrigger.current?.focus())
        }} onOpen={(record) => {
          setHistoryOpen(false)
          resultTrigger.current = historyTrigger.current
          setResult(record)
        }} />
      )}
      {saveOpen && (
        <AudioGenerationSaveDialog format={options.format} onClose={() => {
          setSaveOpen(false)
          requestAnimationFrame(() => trigger.current?.focus())
        }} onConfirm={(name, locationToken) => {
          setSaveOpen(false)
          void submit(() => api().startAudioGeneration(input, options, name, locationToken))
        }} />
      )}
      {result && (
        <AudioGenerationResult key={result.id} result={result}
          onClose={(restoreFocus = true) => {
            setResult(undefined)
            if (restoreFocus) {
              requestAnimationFrame(() => {
                const source = resultTrigger.current
                if (source?.isConnected) source.focus()
                else trigger.current?.focus()
              })
            }
          }} />
      )}
    </div>
  )
}
