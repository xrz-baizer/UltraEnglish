import { TranscriptionModelDialog } from './transcription-model-dialog'
import { SubtitlesManager } from './subtitles-manager'
import { ActionTooltip } from '@renderer/components/ui/action-tooltip'
import { AudioNotes, type Note } from './audio-notes'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ListMusic,
  ArrowLeft,
  NotebookPen,
  ALargeSmall,
  NotebookText,
  TextCursorInput,
  FileText,
  Pause,
  Play,
  Repeat,
  Scissors,
  Minus,
  Plus,
  SkipBack,
  SkipForward,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { toast } from 'sonner'
import { useAudioWaveform } from '@renderer/components/audio-waveform'
import { useContinuousAudio } from '@renderer/hooks/use-continuous-audio'
import { useAudioClip } from '@renderer/hooks/use-audio-clip'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn, formatDuration } from '@renderer/lib/utils'
import { getSegmentWords } from '../../../shared/audio-transcription'
import type { TranscriptionSegment } from '../../../shared/audio-transcription'

interface AudioDetail {
  id: string
  name: string
  filePath: string
  format?: string
}
interface Transcript {
  segments?: TranscriptionSegment[]
  error?: string
}
interface Selection {
  from: number
  to: number
}

export function AudioDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [audio, setAudio] = useState<AudioDetail | null>(null)
  const [segments, setSegments] = useState<TranscriptionSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const [loop, setLoop] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [speedDraft, setSpeedDraft] = useState('1')
  const changeSpeed = (value: number) => {
    const next =
      Math.round(
        Math.max(0.25, Math.min(3, Number.isFinite(value) ? value : 1)) * 100
      ) / 100
    setSpeed(next)
    setSpeedDraft(String(next))
  }
  const studyRef = useRef<HTMLDivElement>(null)
  const resizingTrack = useRef(false)
  const [trackHeight, setTrackHeight] = useState(() => {
    const saved = Number(localStorage.getItem('audio-track-height'))
    return saved >= 180 && saved <= 600 ? saved : 220
  })
  useEffect(() => {
    localStorage.setItem('audio-track-height', String(trackHeight))
  }, [trackHeight])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!resizingTrack.current) return
      const rect = studyRef.current?.getBoundingClientRect()
      if (rect)
        setTrackHeight(
          Math.max(
            180,
            Math.min(rect.height - 260, rect.bottom - event.clientY - 12)
          )
        )
    }
    const stop = () => {
      resizingTrack.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [])
  useEffect(() => {
    const element = studyRef.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setTrackHeight((value) =>
        Math.max(180, Math.min(value, element.clientHeight - 260))
      )
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading])
  const panelsRef = useRef<HTMLDivElement>(null)
  const draggingPanels = useRef(false)
  const [panelRatio, setPanelRatio] = useState(() => {
    const saved = Number(localStorage.getItem('audio-panel-ratio'))
    return saved >= 30 && saved <= 78 ? saved : 66
  })
  useEffect(() => {
    localStorage.setItem('audio-panel-ratio', String(panelRatio))
  }, [panelRatio])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!draggingPanels.current) return
      const rect = panelsRef.current?.getBoundingClientRect()
      if (rect)
        setPanelRatio(
          Math.max(
            30,
            Math.min(78, ((event.clientX - rect.left) / rect.width) * 100)
          )
        )
    }
    const stop = () => {
      draggingPanels.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [])
  const audioSettings = useSettingsStore((state) => state.settings.audio)
  const updateAudioSettings = useSettingsStore(
    (state) => state.updateAudioSettings
  )
  const noteFontSize = audioSettings.inlineNoteFontSize || 13
  const fontSize = audioSettings.sentenceFontSize || 26
  const setFontSize = (value: number) =>
    void updateAudioSettings({ sentenceFontSize: value })
  const [fullPlayback, setFullPlayback] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [managingSubtitles, setManagingSubtitles] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [editorRequest, setEditorRequest] = useState(0)
  const [showInlineNotes, setShowInlineNotes] = useState(false)
  const [inlineNotes, setInlineNotes] = useState<Note[]>([])
  const [editingTiming, setEditingTiming] = useState(false)
  const rangeHandle = useRef<'start' | 'end' | null>(null)
  const [trackRange, setTrackRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const trackAnchor = useRef<number | null>(null)
  const sentenceScrollRef = useRef<HTMLDivElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLButtonElement>(null)
  const pointerAnchor = useRef<number | null>(null)
  const selectionRef = useRef<Selection | null>(null)
  const pendingPlay = useRef(false)
  const requestRef = useRef(0)
  const mounted = useRef(true)
  const active = segments[selected]
  const timed = useMemo(
    () => (active ? getSegmentWords(active) : { words: [], estimated: false }),
    [active]
  )
  const source = audio
    ? `file://${audio.filePath.split('/').map(encodeURIComponent).join('/')}`
    : ''
  const clipStart = active
    ? editingTiming
      ? Math.max(0, active.startTime - 3)
      : active.startTime
    : 0
  const clipSegment =
    active && editingTiming
      ? { ...active, startTime: clipStart, endTime: active.endTime + 3 }
      : active
  const clip = useAudioClip(source, clipSegment)
  const trackGeometry = () => {
    const shadow = waveformRef.current?.firstElementChild?.shadowRoot
    const scroll = shadow?.querySelector('.scroll') as HTMLElement | null
    const wrapper = shadow?.querySelector('.wrapper') as HTMLElement | null
    return {
      width: wrapper?.scrollWidth || waveformRef.current?.clientWidth || 1,
      offset: scroll?.scrollLeft || 0
    }
  }
  const trackTime = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const geometry = trackGeometry()
    return (
      Math.max(
        0,
        Math.min(
          1,
          (event.clientX - rect.left + geometry.offset) / geometry.width
        )
      ) * player.duration
    )
  }
  const onWaveformSeek = (time: number) => {
    changeSelection(null)
    setTrackRange(null)
    player.playSegment(time, player.duration, loop)
  }
  const waveform = useAudioWaveform(
    waveformRef,
    loading ? '' : clip.src,
    onWaveformSeek,
    Math.max(80, trackHeight - 108)
  )
  const continuous = useContinuousAudio(source, (time) => {
    if (fullPlayback && !waveform.isLoading)
      waveform.seekTo(Math.max(0, time - clipStart))
  })
  const player = {
    ...waveform,
    ...(fullPlayback
      ? {
          isPlaying: continuous.isPlaying,
          currentTime: Math.max(0, continuous.currentTime - clipStart),
          error: continuous.error || waveform.error,
          pause: continuous.pause,
          playSegment: (
            start: number,
            end: number,
            looped: boolean,
            position = start
          ) =>
            continuous.playSegment(
              start + clipStart,
              trackRange ? end + clipStart : clip.duration,
              looped,
              position + clipStart
            ),
          seekTo: (time: number) => continuous.seekTo(time + clipStart),
          setPlaybackRate: continuous.setPlaybackRate,
          setVolume: continuous.setVolume,
          setMuted: continuous.setMuted
        }
      : {})
  }
  const ready =
    !!active &&
    !loading &&
    !clip.loading &&
    !player.isLoading &&
    player.duration > 0 &&
    !player.error &&
    !clip.error
  const changeSelection = useCallback((value: Selection | null) => {
    if (value) {
      const start =
        timed.words[Math.min(value.from, value.to)].startTime - clipStart
      const end =
        timed.words[Math.max(value.from, value.to)].endTime - clipStart
      setTrackRange({ start, end })
    }
    selectionRef.current = value
    setSelection(value)
  }, [timed.words, clipStart])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let disposed = false
    requestRef.current++
    setLoading(true)
    setAudio(null)
    setSegments([])
    setSelected(0)
    setError(null)
    setBusy(false)
    changeSelection(null)
    if (!id) {
      setLoading(false)
      return
    }
    void Promise.all([
      window.electronAPI.getAudioById(id),
      window.electronAPI.getTranscription(id)
    ])
      .then(([audio, transcript]) => {
        if (disposed) return
        setAudio(audio as AudioDetail | null)
        setSegments((transcript as Transcript | null)?.segments || [])
      })
      .catch(() => {
        if (!disposed) setError(t('audio.loadFailed'))
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [id, t])

  useEffect(() => {
    sentenceScrollRef.current?.scrollTo({ top: 0 })
  }, [active?.id])
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  useEffect(() => {
    if (ready) player.setPlaybackRate(speed)
  }, [speed, ready, player.setPlaybackRate])
  useEffect(() => {
    if (ready) {
      player.setVolume(1)
      player.setMuted(false)
    }
  }, [ready, player.setVolume, player.setMuted])
  useEffect(() => {
    if (!audioSettings.autoPlayOnSentenceChange) pendingPlay.current = false
    if (ready && pendingPlay.current) {
      pendingPlay.current = false
      player.playSegment(0, player.duration, loop)
    }
  }, [ready, player.duration, player.playSegment, loop, audioSettings.autoPlayOnSentenceChange])

  useEffect(() => {
    if (!trackRange) return
    const indices = timed.words.flatMap((word, index) =>
      word.endTime > trackRange.start + clipStart &&
      word.startTime < trackRange.end + clipStart
        ? [index]
        : []
    )
    const next = indices.length
      ? { from: indices[0], to: indices[indices.length - 1] }
      : null
    selectionRef.current = next
    setSelection(next)
  }, [trackRange, timed.words, clipStart])
  const playWords = useCallback(
    (range: Selection | null, resume = false) => {
      if (!ready) return
      const start =
        trackRange?.start ??
        (range
          ? timed.words[Math.min(range.from, range.to)].startTime - clipStart
          : 0)
      const end =
        trackRange?.end ??
        (range
          ? timed.words[Math.max(range.from, range.to)].endTime - clipStart
          : player.duration)
      const from =
        resume && player.currentTime >= start && player.currentTime < end - 0.05
          ? player.currentTime
          : start
      player.playSegment(
        Math.max(0, start),
        Math.min(end, player.duration),
        loop,
        Math.max(0, from)
      )
    },
    [
      trackRange,
      ready,
      timed.words,
      clipStart,
      player.currentTime,
      player.duration,
      player.playSegment,
      loop
    ]
  )
  const togglePlay = useCallback(() => {
    if (player.isPlaying) player.pause()
    else playWords(selectionRef.current, true)
  }, [player.isPlaying, player.pause, playWords])
  const chooseSentence = useCallback((index: number) => {
    if (!segments[index]) return
    const autoPlay = audioSettings.autoPlayOnSentenceChange
    pendingPlay.current = false
    player.pause()
    setTrackRange(null)
    changeSelection(null)
    setEditingTiming(false)
    if (fullPlayback) {
      setSelected(index)
      if (autoPlay) continuous.playSegment(segments[index].startTime, clip.duration, loop)
      else continuous.seekTo(segments[index].startTime)
      return
    }
    if (index === selected) {
      if (autoPlay && ready) player.playSegment(0, player.duration, loop)
      else if (!autoPlay && ready) player.seekTo(0)
    } else {
      pendingPlay.current = autoPlay
      setSelected(index)
    }
  }, [segments, player.pause, player.playSegment, player.seekTo, player.duration, fullPlayback, clip.duration, continuous.playSegment, continuous.seekTo, loop, selected, ready, changeSelection, audioSettings.autoPlayOnSentenceChange])
  useEffect(() => {
    const finishSelection = () => {
      if (pointerAnchor.current === null) return
      pointerAnchor.current = null
    }
    const cancelSelection = () => {
      pointerAnchor.current = null
    }
    window.addEventListener('pointerup', finishSelection)
    window.addEventListener('pointercancel', cancelSelection)
    return () => {
      window.removeEventListener('pointerup', finishSelection)
      window.removeEventListener('pointercancel', cancelSelection)
    }
  }, [playWords])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey || event.ctrlKey || event.altKey ||
        useSettingsStore.getState().isOpen ||
        managingSubtitles || confirmImport || confirmRegenerate ||
        target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="slider"],[role="separator"]')
      ) return
      if (event.key === 'Escape') {
        pendingPlay.current = false
        player.pause()
        changeSelection(null)
        setTrackRange(null)
        return
      }
      if (event.shiftKey) return
      if (event.code === 'Space') {
        if (target?.closest('.audio-autoplay-toggle')) return
        if (target?.closest('button,a,[role="switch"]') && !target.closest('.sentence-toolbar-secondary,.sentence-word,.audio-transcript,.audio-player-panel')) return
        event.preventDefault()
        event.stopPropagation()
        if (ready && !event.repeat) togglePlay()
      } else if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
        if (target && !studyRef.current?.contains(target) && target !== document.body) return
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat && active && !loading && !busy) {
          chooseSentence(
            selected + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
          )
        }
      }
    }
    // Capture before native button activation and the per-word handlers.
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [togglePlay, chooseSentence, changeSelection, player.pause, ready, selected, active, loading, busy, managingSubtitles, confirmImport, confirmRegenerate])

  const updateSubtitles = async (
    generate: boolean,
    modelId?: string,
    pastedText?: string
  ) => {
    if (!id || busy) return
    const request = ++requestRef.current
    setBusy(true)
    setError(null)
    player.pause()
    try {
      const result = (await (pastedText !== undefined
        ? window.electronAPI.alignSubtitleText(id, pastedText)
        : generate
          ? window.electronAPI.transcribeAudio(id, modelId)
          : window.electronAPI.importSubtitle(
              id,
              clip.duration
            ))) as Transcript | null
      if (!mounted.current || request !== requestRef.current) return
      if (result?.error) {
        const known = ['no_model', 'no_engine', 'no_ffmpeg', 'no_speech']
        setError(
          generate
            ? t(
                `audio.transcriptionErrors.${known.includes(result.error) ? result.error : 'transcription_error'}`
              )
            : t(
                result.error === 'alignment_failed'
                  ? 'audio.textAlignmentFailed'
                  : 'audio.subtitleFailed'
              )
        )
      } else if (result?.segments) {
        setSegments(result.segments)
        setManagingSubtitles(false)
        setSelected(0)
        setTrackRange(null)
        setEditingTiming(false)
        changeSelection(null)
      } else if (generate)
        setError(t('audio.transcriptionErrors.transcription_error'))
    } catch {
      if (mounted.current && request === requestRef.current)
        setError(
          t(
            generate
              ? 'audio.transcriptionErrors.transcription_error'
              : 'audio.subtitleFailed'
          )
        )
    } finally {
      if (mounted.current && request === requestRef.current) setBusy(false)
    }
  }
  const selectedText = selection
    ? timed.words
        .slice(
          Math.min(selection.from, selection.to),
          Math.max(selection.from, selection.to) + 1
        )
        .map((word) => word.text)
        .join(' ')
    : active?.text || ''
  const saveAllSubtitles = async (draft: TranscriptionSegment[]) => {
    if (!id) throw new Error('Audio unavailable')
    const transcript = (await window.electronAPI.getTranscription(id)) as {
      id: string
      segments: TranscriptionSegment[]
    }
    if (JSON.stringify(transcript.segments) !== JSON.stringify(segments))
      throw new Error('Subtitles changed')
    const next = draft.map((segment) => {
      const original = segments.find((item) => item.id === segment.id)!
      return segment.text.trim() === original.text
        ? original
        : {
            ...original,
            text: segment.text.trim(),
            words: undefined,
            ipa: undefined
          }
    })
    await window.electronAPI.updateTranscription(transcript.id, {
      segments: next,
      content: next.map((segment) => segment.text).join(' ')
    })
    player.pause()
    setSegments(next)
    changeSelection(null)
    setTrackRange(null)
  }
  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      if (
        useSettingsStore.getState().isOpen ||
        managingSubtitles ||
        (event.target as HTMLElement)?.closest?.(
          'input,textarea,[contenteditable=true]'
        )
      )
        return
      if (!selectionRef.current && window.getSelection()?.toString()) return
      if (!active) return
      event.preventDefault()
      event.clipboardData?.setData('text/plain', selectedText)
    }
    const onCopyKey = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'c' ||
        event.altKey ||
        useSettingsStore.getState().isOpen ||
        managingSubtitles ||
        !active ||
        (event.target as HTMLElement)?.closest?.(
          'input,textarea,[contenteditable=true]'
        )
      )
        return
      if (!selectionRef.current && window.getSelection()?.toString()) return
      event.preventDefault()
      void window.electronAPI
        .writeClipboardText(selectedText)
        .catch(() => toast.error(t('audio.copyFailed')))
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('keydown', onCopyKey)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('keydown', onCopyKey)
    }
  }, [selectedText, active, managingSubtitles])
  useEffect(() => {
    if (!fullPlayback || !player.isPlaying || trackRange) return
    const index = segments.findIndex(
      (segment) =>
        continuous.currentTime >= segment.startTime &&
        continuous.currentTime < segment.endTime
    )
    if (index >= 0 && index !== selected) {
      setSelected(index)
      changeSelection(null)
    }
  }, [
    fullPlayback,
    continuous.currentTime,
    player.isPlaying,
    segments,
    selected,
    trackRange
  ])
  const saveTiming = async () => {
    if (!id || !active || !trackRange || trackRange.end <= trackRange.start)
      return
    try {
      const transcript = (await window.electronAPI.getTranscription(id)) as {
        id: string
      }
      const next = segments.map((segment) =>
        segment.id === active.id
          ? {
              ...segment,
              startTime: trackRange.start + clipStart,
              endTime: trackRange.end + clipStart
            }
          : segment
      )
      await window.electronAPI.updateTranscription(transcript.id, {
        segments: next
      })
      player.pause()
      setSegments(next)
      setEditingTiming(false)
      setTrackRange(null)
      changeSelection(null)
      toast.success(t('audio.timingSaved'))
    } catch {
      toast.error(t('audio.timingFailed'))
    }
  }
  if (loading)
    return (
      <div className="content-container" role="status">
        {t('common.loading')}
      </div>
    )
  if (!audio)
    return (
      <div className="content-container">
        <p role="alert">{error || t('audio.loadFailed')}</p>
        <button
          className="secondary-button"
          onClick={() => navigate('/audios')}
        >
          {t('common.back')}
        </button>
      </div>
    )
  const globalTime = player.currentTime + clipStart
  return (
    <div className="audio-study" ref={studyRef}>
      {managingSubtitles && (
        <SubtitlesManager
          segments={segments}
          busy={busy}
          error={error}
          onClose={() => setManagingSubtitles(false)}
          onSave={saveAllSubtitles}
          onRegenerate={() => setConfirmRegenerate(true)}
          onImport={() => setConfirmImport(true)}
          onPasteText={(text) => void updateSubtitles(false, undefined, text)}
        />
      )}
      <Dialog open={confirmImport} onOpenChange={setConfirmImport}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{t('audio.confirmImportSubtitles')}</DialogTitle>
          <p className="text-sm">{t('audio.importSubtitlesWarning')}</p>
          <div className="flex justify-end gap-2">
            <button
              className="secondary-button"
              onClick={() => setConfirmImport(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setConfirmImport(false)
                void updateSubtitles(false)
              }}
            >
              {t('audio.uploadSubtitles')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {confirmRegenerate && (
        <TranscriptionModelDialog
          onClose={() => setConfirmRegenerate(false)}
          onConfirm={(modelId) => {
            setConfirmRegenerate(false)
            void updateSubtitles(true, modelId)
          }}
        />
      )}
      <header className="audio-study-header drag-region flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link
          className="audio-back-link"
          to="/audios"
          aria-label={t('audio.backToLibrary')}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('audio.backToLibrary')}
        </Link>
        <h1
          className="min-w-0 max-w-96 truncate font-medium"
          title={audio.name}
        >
          {audio.name}
        </h1>
      </header>
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm"
        >
          <span>{error}</span>
          <button
            className="icon-button shrink-0"
            aria-label={t('common.close')}
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div
        className="audio-study-panels"
        ref={panelsRef}
        style={{
          gridTemplateColumns: `minmax(0, ${panelRatio}fr) 10px minmax(0, ${100 - panelRatio}fr)`
        }}
      >
        <section className="audio-sentence surface-panel">
          <div className="sentence-toolbar glass-toolbar">
            <div className="sentence-toolbar-main">
              <button
                className="secondary-button subtitle-manager-action audio-important-action"
                disabled={busy}
                aria-label={t('audio.manageSubtitles')}
                onClick={() => {
                  player.pause()
                  setManagingSubtitles(true)
                }}
              >
                {t('audio.manageSubtitles')}
              </button>
            </div>
            <div className="sentence-toolbar-secondary" onMouseDown={(event) => {
              // Mouse adjustments must not leave Space targeting a size button.
              if ((event.target as Element).closest('button')) event.preventDefault()
            }}>
              <ActionTooltip label={t('audio.writeNote')}>
                <button
                  className="text-control write-note-action"
                  aria-label={t('audio.writeNote')}
                  disabled={!active}
                  onClick={() => setEditorRequest((value) => value + 1)}
                >
                  <NotebookPen className="h-5 w-5" />
                </button>
              </ActionTooltip>
              <div
                className="size-stepper"
                role="group"
                aria-label={t('settings.audio.sentenceSize')}
              >
                <span className="size-stepper-label">
                  <ALargeSmall className="h-4 w-4" aria-hidden="true" />
                </span>
                <ActionTooltip label={t('audio.smallerText')}>
                  <button
                    className="text-control"
                    title={t('audio.smallerText')}
                    aria-label={t('audio.smallerText')}
                    disabled={fontSize <= 18}
                    onClick={() => setFontSize(Math.max(18, fontSize - 2))}
                  >
                    <ZoomOut className="h-5 w-5" aria-hidden="true" />
                  </button>
                </ActionTooltip>
                <ActionTooltip label={t('audio.largerText')}>
                  <button
                    className="text-control"
                    title={t('audio.largerText')}
                    aria-label={t('audio.largerText')}
                    disabled={fontSize >= 42}
                    onClick={() => setFontSize(Math.min(42, fontSize + 2))}
                  >
                    <ZoomIn className="h-5 w-5" aria-hidden="true" />
                  </button>
                </ActionTooltip>
              </div>
              <div
                className="size-stepper"
                role="group"
                aria-label={t('audio.noteFontSize')}
              >
                <span className="size-stepper-label">
                  <NotebookText className="h-4 w-4" aria-hidden="true" />
                </span>
                <ActionTooltip label={t('audio.smallerNotes')}>
                  <button
                    className="text-control"
                    title={t('audio.smallerNotes')}
                    aria-label={t('audio.smallerNotes')}
                    disabled={noteFontSize <= 10}
                    onClick={() =>
                      void updateAudioSettings({
                        inlineNoteFontSize: Math.max(10, noteFontSize - 1)
                      })
                    }
                  >
                    <ZoomOut className="h-5 w-5" aria-hidden="true" />
                  </button>
                </ActionTooltip>
                <ActionTooltip label={t('audio.largerNotes')}>
                  <button
                    className="text-control"
                    title={t('audio.largerNotes')}
                    aria-label={t('audio.largerNotes')}
                    disabled={noteFontSize >= 24}
                    onClick={() =>
                      void updateAudioSettings({
                        inlineNoteFontSize: Math.min(24, noteFontSize + 1)
                      })
                    }
                  >
                    <ZoomIn className="h-5 w-5" aria-hidden="true" />
                  </button>
                </ActionTooltip>
              </div>
              <ActionTooltip label={t('audio.inlineNotes')}>
                <button
                  className="inline-note-switch"
                  aria-label={t('audio.inlineNotes')}
                  role="switch"
                  aria-checked={showInlineNotes}
                  onClick={() => setShowInlineNotes(!showInlineNotes)}
                >
                  <span aria-hidden="true" />
                </button>
              </ActionTooltip>
            </div>
          </div>
          <div className="sentence-scroll" ref={sentenceScrollRef}>
            <div className="sentence-content">
              {active ? (
                <div className="w-full text-left">
                  <div
                    className="sentence-words"
                    style={{
                      fontFamily: audioSettings.sentenceFontFamily,
                      fontWeight: audioSettings.sentenceFontWeight || 400,
                      fontSize: `calc(${fontSize + 2}px * var(--font-scale, 1))`
                    }}
                  >
                    {timed.words.map((word, index) => {
                      const chosen =
                        selection &&
                        index >= Math.min(selection.from, selection.to) &&
                        index <= Math.max(selection.from, selection.to)
                      const playing =
                        player.isPlaying &&
                        globalTime >= word.startTime &&
                        globalTime < word.endTime
                      return (
                        <Fragment key={`${index}-${word.text}`}>
                          <span className="inline-flex max-w-full flex-col align-top">
                            <button
                              disabled={!ready}
                              aria-pressed={!!chosen}
                              className={cn(
                                'sentence-word',
                                chosen && 'is-selected',
                                playing && 'is-playing'
                              )}
                              onPointerDown={(event) => {
                                if (event.button !== 0) return
                                event.preventDefault()
                                event.currentTarget.focus()
                                pointerAnchor.current = event.shiftKey
                                  ? (selectionRef.current?.from ?? index)
                                  : index
                                player.pause()
                                changeSelection({
                                  from: pointerAnchor.current ?? index,
                                  to: index
                                })
                              }}
                              onPointerEnter={() => {
                                if (pointerAnchor.current !== null)
                                  changeSelection({
                                    from: pointerAnchor.current,
                                    to: index
                                  })
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  const value = {
                                    from: event.shiftKey
                                      ? (selectionRef.current?.from ?? index)
                                      : index,
                                    to: index
                                  }
                                  changeSelection(value)
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.code === 'Space') {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  if (!event.repeat) togglePlay()
                                  return
                                }
                                if (
                                  event.shiftKey &&
                                  ['ArrowLeft', 'ArrowRight'].includes(
                                    event.key
                                  )
                                ) {
                                  event.preventDefault()
                                  const to = Math.max(
                                    0,
                                    Math.min(
                                      timed.words.length - 1,
                                      (selectionRef.current?.to ?? index) +
                                        (event.key === 'ArrowRight' ? 1 : -1)
                                    )
                                  )
                                  changeSelection({
                                    from: selectionRef.current?.from ?? index,
                                    to
                                  })
                                } else if (
                                  event.code === 'Enter' &&
                                  selectionRef.current
                                ) {
                                  event.preventDefault()
                                  playWords(selectionRef.current)
                                }
                              }}
                            >
                              {word.text}
                            </button>
                            {showInlineNotes &&
                              inlineNotes
                                .filter((note) => note.from === index)
                                .map((note) => (
                                  <span
                                    key={note.id}
                                    className="inline-word-note max-w-56"
                                    style={{
                                      fontSize: `calc(${noteFontSize + 2}px * var(--font-scale, 1))`
                                    }}
                                  >
                                    {note.text}
                                  </span>
                                ))}
                          </span>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="audio-generate-empty text-center text-muted-foreground">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-primary-ink/60" />
                  <button
                    disabled={busy}
                    className="primary-button"
                    onClick={() => setConfirmRegenerate(true)}
                  >
                    {t(busy ? 'audio.transcribing' : 'audio.generateSubtitles')}
                  </button>
                </div>
              )}
            </div>
            <div className="sentence-notes">
              {active && (
                <AudioNotes
                  audioId={audio.id}
                  segmentId={active.id}
                  selection={selection}
                  selectedText={selectedText}
                  onNotesChange={setInlineNotes}
                  editorRequest={editorRequest}
                  fontSize={noteFontSize}
                />
              )}
            </div>
          </div>
        </section>
        <div
          className="audio-panel-divider"
          role="separator"
          aria-label={t('audio.resizePanels')}
          aria-orientation="vertical"
          tabIndex={0}
          aria-valuemin={30}
          aria-valuemax={78}
          aria-valuenow={Math.round(panelRatio)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              setPanelRatio((value) =>
                Math.max(
                  30,
                  Math.min(78, value + (event.key === 'ArrowRight' ? 2 : -2))
                )
              )
            }
          }}
          onPointerDown={(event) => {
            draggingPanels.current = true
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const rect = panelsRef.current?.getBoundingClientRect()
            if (rect)
              setPanelRatio(
                Math.max(
                  30,
                  Math.min(78, ((event.clientX - rect.left) / rect.width) * 100)
                )
              )
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId)
          }}
        />
        <section className="audio-transcript surface-panel">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1 thin-scrollbar">
            {segments.length ? (
              <ol className="space-y-2">
                {segments.map((segment, index) => (
                  <li key={segment.id}>
                    <button
                      ref={index === selected ? activeRowRef : undefined}
                      aria-current={selected === index ? 'true' : undefined}
                      onClick={() => chooseSentence(index)}
                      onKeyDown={(event) => {
                        if (event.code === 'Space') {
                          event.preventDefault()
                          event.stopPropagation()
                          if (ready && !event.repeat) togglePlay()
                        }
                      }}
                      className={cn(
                        'w-full rounded-xl border border-transparent p-3 text-left transition-colors',
                        selected !== index && 'hover:bg-muted/60'
                      )}
                    >
                      <span className="flex justify-between text-xs tabular-nums text-muted-foreground">
                        <span>#{index + 1}</span>
                        <span>{formatDuration(segment.startTime)}</span>
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed" style={{ fontFamily: audioSettings.sentenceFontFamily }}>
                        {segment.text.trim().replace(/\s+/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <FileText className="h-8 w-8" />
                <span className="text-sm">
                  {t(busy ? 'audio.transcribing' : 'audio.noSubtitles')}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
      <div
        className="audio-vertical-divider"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('audio.resizeTrack')}
        tabIndex={0}
        aria-valuenow={Math.round(trackHeight)}
        aria-valuemin={180}
        aria-valuemax={600}
        onPointerDown={(event) => {
          event.preventDefault()
          resizingTrack.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const max = Math.max(
              180,
              (studyRef.current?.clientHeight || 600) - 260
            )
            setTrackHeight((value) =>
              Math.max(
                180,
                Math.min(max, value + (event.key === 'ArrowUp' ? 12 : -12))
              )
            )
          }
        }}
      />
      <section
        className="audio-player-panel surface-panel shrink-0 overflow-hidden"
        style={{ height: trackHeight }}
      >
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="relative">
                <div ref={waveformRef} className="min-h-12" />
                <div
                  className="absolute inset-0 z-10 cursor-crosshair overflow-hidden"
                  role="slider"
                  aria-label={t('audio.selectTrack')}
                  aria-valuemin={0}
                  aria-valuemax={player.duration}
                  aria-valuenow={trackRange?.start || 0}
                  onPointerDown={(event) => {
                    if (!ready) return
                    event.currentTarget.setPointerCapture(event.pointerId)
                    player.pause()
                    changeSelection(null)
                    const time = trackTime(event)
                    const handle = (event.target as HTMLElement).dataset.handle
                    rangeHandle.current =
                      handle === 'start' || handle === 'end' ? handle : null
                    if (rangeHandle.current) {
                      trackAnchor.current = time
                      return
                    }
                    trackAnchor.current = time
                    setTrackRange({ start: time, end: time })
                  }}
                  onPointerMove={(event) => {
                    if (trackAnchor.current === null) return
                    const time = trackTime(event)
                    if (rangeHandle.current && trackRange) {
                      setTrackRange(
                        rangeHandle.current === 'start'
                          ? {
                              ...trackRange,
                              start: Math.min(time, trackRange.end - 0.02)
                            }
                          : {
                              ...trackRange,
                              end: Math.max(time, trackRange.start + 0.02)
                            }
                      )
                      return
                    }
                    setTrackRange({
                      start: Math.min(time, trackAnchor.current),
                      end: Math.max(time, trackAnchor.current)
                    })
                  }}
                  onPointerUp={(event) => {
                    if (trackAnchor.current === null) return
                    if (rangeHandle.current) {
                      rangeHandle.current = null
                      trackAnchor.current = null
                      return
                    }
                    const time = trackTime(event)
                    const start = Math.min(time, trackAnchor.current)
                    const end = Math.max(time, trackAnchor.current)
                    trackAnchor.current = null
                    if (end - start < 0.05) {
                      setTrackRange(null)
                      changeSelection(null)
                      if (fullPlayback)
                        continuous.playSegment(
                          start + clipStart,
                          clip.duration,
                          loop
                        )
                      else waveform.playSegment(start, waveform.duration, loop)
                    } else {
                      setTrackRange({ start, end })
                    }
                  }}
                  onPointerCancel={() => {
                    trackAnchor.current = null
                    setTrackRange(null)
                    changeSelection(null)
                  }}
                >
                  {trackRange && player.duration > 0 && (
                    <div
                      className="audio-track-selection"
                      style={{
                        left:
                          (trackRange.start / player.duration) *
                            trackGeometry().width -
                          trackGeometry().offset,
                        width:
                          ((trackRange.end - trackRange.start) /
                            player.duration) *
                          trackGeometry().width
                      }}
                    >
                      <span
                        data-handle="start"
                        className="absolute -left-2 inset-y-0 w-4 cursor-ew-resize"
                      />
                      <span
                        data-handle="end"
                        className="absolute -right-2 inset-y-0 w-4 cursor-ew-resize"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {clip.error || player.error ? (
            <p role="alert" className="text-xs text-destructive">
              {t('audio.loadFailed')}
            </p>
          ) : (
            !ready && (
              <p role="status" className="text-xs text-muted-foreground">
                {t('audio.loadingWaveform')}
              </p>
            )
          )}
        </div>
        <div className="audio-playback-controls glass-toolbar mt-3 border-t px-4 py-4">
          <div className="audio-playback-left">
            <div
              className="flex items-center gap-1 rounded-lg bg-muted/50 p-1"
              role="group"
              aria-label={t('audio.playbackMode')}
            >
              {[false, true].map((full) => {
                const label = t(
                  full ? 'audio.fullPlayback' : 'audio.singlePlayback'
                )
                const Icon = full ? ListMusic : TextCursorInput
                return (
                  <ActionTooltip
                    key={String(full)}
                    label={label}
                    showWhenDisabled
                  >
                    <button
                      key={String(full)}
                      className={cn(
                        'icon-button audio-mode-button',
                        fullPlayback === full && 'bg-primary/10 text-primary-ink'
                      )}
                      aria-label={label}
                      aria-pressed={fullPlayback === full}
                      onClick={() => {
                        if (fullPlayback === full) return
                        player.pause()
                        pendingPlay.current = false
                        setTrackRange(null)
                        changeSelection(null)
                        setEditingTiming(false)
                        setFullPlayback(full)
                      }}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </ActionTooltip>
                )
              })}
            </div>
            <ActionTooltip
              label={t(loop ? 'audio.disableLoop' : 'audio.enableLoop')}
              showWhenDisabled
            >
              <button
                className={cn(
                  'icon-button',
                  loop && 'bg-primary/10 text-primary-ink'
                )}
                aria-label={t('audio.loopSentence')}
                aria-pressed={loop}
                onClick={() => {
                  setLoop(!loop)
                  if (player.isPlaying) {
                    player.pause()
                    const start = trackRange?.start ?? 0
                    const end = trackRange?.end ?? player.duration
                    player.playSegment(start, end, !loop)
                  }
                }}
              >
                <Repeat className="h-5 w-5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label={t(audioSettings.autoPlayOnSentenceChange ? 'audio.disableAutoPlay' : 'audio.enableAutoPlay')}>
              <button
                className="inline-note-switch audio-autoplay-toggle"
                aria-label={t('audio.autoPlay')}
                role="switch"
                aria-checked={audioSettings.autoPlayOnSentenceChange}
                onClick={(event) => {
                  // Pointer clicks return Space to playback; keyboard focus stays usable.
                  if (event.detail > 0) event.currentTarget.blur()
                  if (audioSettings.autoPlayOnSentenceChange) pendingPlay.current = false
                  void updateAudioSettings({ autoPlayOnSentenceChange: !audioSettings.autoPlayOnSentenceChange })
                }}
              >
                <span aria-hidden="true" />
              </button>
            </ActionTooltip>
          </div>
          <div className="audio-playback-center">
            <ActionTooltip label={t('audio.previousSentence')} showWhenDisabled>
              <button
                className="icon-button"
                disabled={selected === 0}
                aria-label={t('audio.previousSentence')}
                onClick={() => chooseSentence(selected - 1)}
              >
                <SkipBack className="h-5 w-5" />
              </button>
            </ActionTooltip>
            <ActionTooltip
              label={t(player.isPlaying ? 'audio.pause' : 'audio.play')}
              showWhenDisabled
            >
              <button
                className="primary-button audio-play-button !rounded-full !p-2"
                disabled={!ready}
                aria-label={t(player.isPlaying ? 'audio.pause' : 'audio.play')}
                onClick={togglePlay}
              >
                {player.isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>
            </ActionTooltip>
            <ActionTooltip label={t('audio.nextSentence')} showWhenDisabled>
              <button
                className="icon-button"
                disabled={selected >= segments.length - 1}
                aria-label={t('audio.nextSentence')}
                onClick={() => chooseSentence(selected + 1)}
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </ActionTooltip>
          </div>
          <div className="audio-playback-right">
            <div className="playback-speed flex items-center gap-1 rounded-lg border p-1">
              <ActionTooltip label={t('audio.slower')} showWhenDisabled>
                <button
                  className="icon-button"
                  aria-label={t('audio.slower')}
                  disabled={speed <= 0.25}
                  onClick={() => changeSpeed(speed - 0.1)}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </ActionTooltip>
              <input
                aria-label={t('audio.playbackSpeed')}
                className="w-10 bg-transparent text-center text-sm tabular-nums"
                type="number"
                min="0.25"
                max="3"
                step="0.05"
                value={speedDraft}
                onChange={(event) => {
                  setSpeedDraft(event.target.value)
                  const value = Number(event.target.value)
                  if (value >= 0.25 && value <= 3) setSpeed(value)
                }}
                onBlur={() => changeSpeed(Number(speedDraft) || 1)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    changeSpeed(Number(speedDraft) || 1)
                    event.currentTarget.blur()
                  }
                }}
              />
              <ActionTooltip label={t('audio.faster')} showWhenDisabled>
                <button
                  className="icon-button"
                  aria-label={t('audio.faster')}
                  disabled={speed >= 3}
                  onClick={() => changeSpeed(speed + 0.1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </ActionTooltip>
            </div>
            <ActionTooltip label={t('audio.editTiming')} showWhenDisabled>
              <button
                className="icon-button"
                disabled={!active || busy}
                aria-label={t('audio.editTiming')}
                aria-pressed={editingTiming}
                onClick={() => {
                  player.pause()
                  changeSelection(null)
                  pendingPlay.current = false
                  if (editingTiming) {
                    setEditingTiming(false)
                    setTrackRange(null)
                  } else {
                    setEditingTiming(true)
                    const origin = Math.max(0, active!.startTime - 3)
                    setTrackRange({
                      start: active!.startTime - origin,
                      end: active!.endTime - origin
                    })
                  }
                }}
              >
                <Scissors className="h-5 w-5" />
              </button>
            </ActionTooltip>
            {editingTiming && (
              <>
                <ActionTooltip label={t('common.cancel')} showWhenDisabled>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setEditingTiming(false)
                      setTrackRange(null)
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </ActionTooltip>
                <ActionTooltip label={t('common.save')} showWhenDisabled>
                  <button
                    className="primary-button"
                    onClick={() => void saveTiming()}
                  >
                    {t('common.save')}
                  </button>
                </ActionTooltip>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
