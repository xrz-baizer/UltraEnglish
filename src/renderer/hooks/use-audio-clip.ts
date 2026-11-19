import { useEffect, useState } from 'react'
import type { TranscriptionSegment } from '../../shared/audio-transcription'
import { encodeAudioClip } from '../lib/audio-clip'

export function useAudioClip(source: string, segment?: TranscriptionSegment) {
  const [decoded, setDecoded] = useState<{ source: string; buffer: AudioBuffer } | null>(null)
  const [clip, setClip] = useState<{ key: string; url: string } | null>(null)
  const [error, setError] = useState(false)
  const key = `${source}:${segment?.id || 'full'}:${segment?.startTime}:${segment?.endTime}`
  useEffect(() => {
    if (!source) return
    let disposed = false
    const abort = new AbortController()
    const context = new AudioContext()
    setError(false)
    void fetch(source, { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Audio unavailable')
        return response.arrayBuffer()
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (!disposed) setDecoded({ source, buffer })
      })
      .catch(() => {
        if (!disposed) setError(true)
      })
      .finally(() => {
        void context.close()
      })
    return () => {
      disposed = true
      abort.abort()
    }
  }, [source])
  useEffect(() => {
    if (!decoded || decoded.source !== source) return
    const start = segment?.startTime || 0
    const end = Math.min(segment?.endTime || decoded.buffer.duration, decoded.buffer.duration)
    if (end <= start) {
      setError(true)
      return
    }
    const url = URL.createObjectURL(
      new Blob([encodeAudioClip(decoded.buffer, start, end)], { type: 'audio/wav' })
    )
    setClip({ key, url })
    return () => URL.revokeObjectURL(url)
  }, [decoded, key, source, segment?.startTime, segment?.endTime])
  return {
    src: clip?.key === key ? clip.url : '',
    loading: !error && clip?.key !== key,
    error,
    duration: decoded?.source === source ? decoded.buffer.duration : 0
  }
}
