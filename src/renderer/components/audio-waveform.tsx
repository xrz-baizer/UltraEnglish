import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

function getWaveformColors() {
  const style = getComputedStyle(document.documentElement)
  const primary = style.getPropertyValue('--primary').trim()
  const waveform = style.getPropertyValue('--waveform').trim()
  const progress = style.getPropertyValue('--waveform-progress').trim() || primary
  const cursor = style.getPropertyValue('--waveform-cursor').trim() || progress
  return {
    waveColor: `hsl(${waveform})`,
    progressColor: `hsl(${progress})`,
    cursorColor: `hsl(${cursor})`
  }
}

interface AudioWaveformProps {
  src: string
  onReady?: (duration: number) => void
  onTimeUpdate?: (currentTime: number) => void
  onPlay?: () => void
  onPause?: () => void
  onFinish?: () => void
  height?: number
  waveColor?: string
  progressColor?: string
  cursorColor?: string
  barWidth?: number
  barGap?: number
  barRadius?: number
}

export interface AudioWaveformRef {
  play: () => void
  pause: () => void
  stop: () => void
  seekTo: (seconds: number) => void
  setVolume: (volume: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  isPlaying: () => boolean
}

export function AudioWaveform({
  src,
  onReady,
  onTimeUpdate,
  onPlay,
  onPause,
  onFinish,
  height = 80,
  waveColor,
  progressColor,
  cursorColor,
  barWidth = 2,
  barGap = 1,
  barRadius = 2
}: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height,
      ...getWaveformColors(),
      ...(waveColor ? { waveColor } : {}),
      ...(progressColor ? { progressColor } : {}),
      ...(cursorColor ? { cursorColor } : {}),
      cursorWidth: 3,
      barWidth,
      barGap,
      barRadius,
      normalize: true,
      backend: 'WebAudio',
      dragToSeek: true,
      hideScrollbar: true
    })

    const colorsObserver = new MutationObserver(() => wavesurfer.setOptions({
      ...getWaveformColors(),
      ...(waveColor ? { waveColor } : {}),
      ...(progressColor ? { progressColor } : {}),
      ...(cursorColor ? { cursorColor } : {})
    }))
    colorsObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    wavesurferRef.current = wavesurfer

    // Load the audio
    wavesurfer.load(src)

    // Event listeners
    wavesurfer.on('ready', () => {
      setIsLoading(false)
      const dur = wavesurfer.getDuration()
      setDuration(dur)
      onReady?.(dur)
    })

    wavesurfer.on('audioprocess', () => {
      const time = wavesurfer.getCurrentTime()
      setCurrentTime(time)
      onTimeUpdate?.(time)
    })

    wavesurfer.on('seeking', () => {
      const time = wavesurfer.getCurrentTime()
      setCurrentTime(time)
      onTimeUpdate?.(time)
    })

    wavesurfer.on('play', () => {
      setIsPlaying(true)
      onPlay?.()
    })

    wavesurfer.on('pause', () => {
      setIsPlaying(false)
      onPause?.()
    })

    wavesurfer.on('finish', () => {
      setIsPlaying(false)
      onFinish?.()
    })

    wavesurfer.on('error', (error) => {
      console.error('WaveSurfer error:', error)
      setIsLoading(false)
    })

    return () => {
      colorsObserver.disconnect()
      wavesurfer.destroy()
    }
  }, [src])

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    wavesurferRef.current?.playPause()
  }, [])

  // Seek to specific time
  const seekTo = useCallback(
    (seconds: number) => {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(seconds / duration)
      }
    },
    [duration]
  )

  // Set volume
  const setVolume = useCallback((volume: number) => {
    wavesurferRef.current?.setVolume(volume)
  }, [])

  // Skip forward/backward
  const skip = useCallback(
    (seconds: number) => {
      if (wavesurferRef.current) {
        const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
        wavesurferRef.current.seekTo(newTime / duration)
      }
    },
    [currentTime, duration]
  )

  return (
    <div className="relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">
              Loading waveform...
            </span>
          </div>
        </div>
      )}

      {/* Waveform container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg transition-opacity duration-300"
        style={{ opacity: isLoading ? 0.3 : 1, minHeight: height }}
      />

      {/* Expose methods via context or ref pattern */}
      <WaveformContext.Provider
        value={{
          isPlaying,
          isLoading,
          currentTime,
          duration,
          togglePlayPause,
          seekTo,
          setVolume,
          skip
        }}
      >
        {null}
      </WaveformContext.Provider>
    </div>
  )
}

// Context for waveform controls
import { createContext, useContext } from 'react'

interface WaveformContextValue {
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  togglePlayPause: () => void
  seekTo: (seconds: number) => void
  setVolume: (volume: number) => void
  skip: (seconds: number) => void
}

const WaveformContext = createContext<WaveformContextValue | null>(null)

export function useWaveform() {
  const context = useContext(WaveformContext)
  if (!context) {
    throw new Error('useWaveform must be used within AudioWaveform')
  }
  return context
}

// One player instance per source. Sentence boundaries use WaveSurfer's media timer.
export function useAudioWaveform(
  containerRef: React.RefObject<HTMLDivElement>,
  src: string,
  onSeek?: (time: number) => void,
  height = 102
) {
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const onSeekRef = useRef(onSeek)
  onSeekRef.current = onSeek
  const rangeRef = useRef<{ start: number; end: number; loop: boolean } | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  // A new sentence must not inherit the previous source's ready state.
  const [loadedSrc, setLoadedSrc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !src) return
    let disposed = false
    setIsLoading(true)
    setIsPlaying(false)
    setError(null)
    setCurrentTime(0)
    setDuration(0)
    rangeRef.current = null
    const player = WaveSurfer.create({
      container: containerRef.current,
      height,
      ...getWaveformColors(),
      cursorWidth: 3,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: 'MediaElement',
      dragToSeek: true,
      hideScrollbar: true
    })
    const applyColors = () => {
      player.setOptions(getWaveformColors())
    }
    applyColors()
    const colorsObserver = new MutationObserver(applyColors)
    colorsObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']})
    wavesurferRef.current = player
    const handleError = (loadError: Error) => {
      if (disposed) return
      setError(loadError.message)
      setIsLoading(false)
    }
    player.on('ready', () => {
      if (disposed) return
      setLoadedSrc(src)
      setIsLoading(false)
      setDuration(player.getDuration())
    })
    player.on('timeupdate', setCurrentTime)
    player.on('play', () => setIsPlaying(true))
    const restartLoop = () => {
      const range = rangeRef.current
      if (range?.loop && player.getCurrentTime() >= range.end - 0.03) {
        queueMicrotask(() => {
          if (!disposed && rangeRef.current === range && !player.isPlaying())
            void player.play(range.start, range.end).catch(handleError)
        })
      }
    }
    player.on('finish', restartLoop)
    player.on('pause', () => {
      setIsPlaying(false)
      restartLoop()
    })
    player.on('interaction', (time) => {
      rangeRef.current = null
      onSeekRef.current?.(time)
    })
    player.on('error', handleError)
    void player.load(src).catch(handleError)
    return () => {
      disposed = true
      colorsObserver.disconnect()
      rangeRef.current = null
      wavesurferRef.current = null
      player.destroy()
    }
  }, [containerRef, src])

  useEffect(() => { wavesurferRef.current?.setOptions({height}) }, [height, src])
  const play = useCallback(() => {
    rangeRef.current = null
    void wavesurferRef.current?.play().catch((error) => setError(String(error)))
  }, [])
  const playSegment = useCallback(
    (start: number, end: number, loop: boolean, initialPosition = start) => {
      const player = wavesurferRef.current
      if (!player || end <= start) return
      rangeRef.current = {
        start,
        end: Math.min(end, player.getDuration()),
        loop
      }
      void player
        .play(initialPosition, rangeRef.current.end)
        .catch((error) => setError(String(error)))
    },
    []
  )
  const pause = useCallback(() => {
    rangeRef.current = null
    wavesurferRef.current?.pause()
  }, [])
  const seekTo = useCallback((seconds: number) => {
    rangeRef.current = null
    const player = wavesurferRef.current
    if (player)
      player.setTime(Math.max(0, Math.min(seconds, player.getDuration())))
  }, [])
  const setPlaybackRate = useCallback(
    (rate: number) => wavesurferRef.current?.setPlaybackRate(rate, true),
    []
  )
  const setVolume = useCallback(
    (volume: number) => wavesurferRef.current?.setVolume(volume),
    []
  )
  const setMuted = useCallback(
    (muted: boolean) => wavesurferRef.current?.setMuted(muted),
    []
  )
  const zoom = useCallback(
    (factor: number) => {
      const player = wavesurferRef.current
      if (player && player.getDuration() > 0 && containerRef.current)
        player.zoom(
          factor === 1
            ? 0
            : (factor * containerRef.current.clientWidth) / player.getDuration()
        )
    },
    [containerRef]
  )
  return {
    zoom,
    isLoading: isLoading || (!error && loadedSrc !== src),
    error,
    isPlaying,
    currentTime,
    duration: loadedSrc === src ? duration : 0,
    play,
    playSegment,
    pause,
    seekTo,
    setPlaybackRate,
    setVolume,
    setMuted
  }
}
