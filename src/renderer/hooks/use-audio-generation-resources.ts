import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationDownload, GenerationResource, GenerationResourceId } from '../../shared/audio-generation'

export function useAudioGenerationResources() {
  const [resources, setResources] = useState<GenerationResource[]>()
  const [download, setDownload] = useState<GenerationDownload | null>(null)
  const [fault, setFault] = useState<'load' | 'download'>()
  const mounted = useRef(false)
  const sequence = useRef(0)
  const progressVersion = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++sequence.current
    const version = progressVersion.current
    try {
      const snapshot = await window.electronAPI.getAudioGenerationResources()
      if (!mounted.current || request !== sequence.current) return
      setResources(snapshot.resources)
      if (progressVersion.current === version) setDownload(snapshot.download)
      setFault((current) => current === 'load' ? undefined : current)
    } catch {
      if (mounted.current && request === sequence.current) {
        setResources(undefined)
        setFault('load')
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = window.electronAPI.onAudioGenerationResourcesChanged((progress) => {
      progressVersion.current++
      setDownload(progress)
      if (!progress) void refresh()
    })
    void refresh()
    return () => {
      mounted.current = false
      sequence.current++
      unsubscribe()
    }
  }, [refresh])

  const startDownload = async (ids: GenerationResourceId[]) => {
    setFault(undefined)
    try {
      await window.electronAPI.downloadAudioGenerationResources(ids)
    } catch {
      if (mounted.current) setFault('download')
    }
  }

  return { resources, download, fault, refresh, startDownload }
}
