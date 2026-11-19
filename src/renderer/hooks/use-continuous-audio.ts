import { useCallback, useEffect, useRef, useState } from 'react'

/** Full-file transport independent of the currently displayed sentence waveform. */
export function useContinuousAudio(
  source: string,
  onFrame?: (time: number) => void
) {
  const frameCallback = useRef(onFrame)
  frameCallback.current = onFrame
  const media = useRef<HTMLAudioElement | null>(null)
  const range = useRef<{ start: number; end: number; loop: boolean } | null>(
    null
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!source) return
    const audio = new Audio(source)
    media.current = audio
    setCurrentTime(0)
    setIsPlaying(false)
    setError(null)
    range.current = null
    let frame = 0
    const tick = () => {
      update()
      frameCallback.current?.(audio.currentTime)
      if (!audio.paused) frame = requestAnimationFrame(tick)
    }
    const fail = () => {
      setError('Audio playback failed')
      setIsPlaying(false)
    }
    const update = () => {
      const target = range.current
      if (target && audio.currentTime >= target.end - 0.015) {
        if (target.loop) {
          audio.currentTime = target.start
          if (audio.paused) void audio.play().catch(fail)
        } else {
          range.current = null
          audio.pause()
        }
      }
      setCurrentTime(audio.currentTime)
    }
    audio.ontimeupdate = update
    audio.onended = update
    audio.onplay = () => {
      setIsPlaying(true)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }
    audio.onpause = () => {
      setIsPlaying(false)
      cancelAnimationFrame(frame)
      frameCallback.current?.(audio.currentTime)
    }
    audio.onerror = fail
    return () => {
      cancelAnimationFrame(frame)
      audio.ontimeupdate =
        audio.onended =
        audio.onplay =
        audio.onpause =
        audio.onerror =
          null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      media.current = null
    }
  }, [source])
  const pause = useCallback(() => {
    range.current = null
    media.current?.pause()
  }, [])
  const playSegment = useCallback(
    (start: number, end: number, loop: boolean, position = start) => {
      const audio = media.current
      if (!audio) return
      range.current = { start, end, loop }
      audio.currentTime = position
      void audio.play().catch(() => {
        if (media.current !== audio || audio.paused) return
        setError('Audio playback failed')
        setIsPlaying(false)
      })
    },
    []
  )
  const seekTo = useCallback((time: number) => {
    if (media.current) {
      media.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])
  const setPlaybackRate = useCallback((value: number) => {
    if (media.current) media.current.playbackRate = value
  }, [])
  const setVolume = useCallback((value: number) => {
    if (media.current) media.current.volume = value
  }, [])
  const setMuted = useCallback((value: boolean) => {
    if (media.current) media.current.muted = value
  }, [])
  return {
    currentTime,
    isPlaying,
    error,
    pause,
    playSegment,
    seekTo,
    setPlaybackRate,
    setVolume,
    setMuted
  }
}
