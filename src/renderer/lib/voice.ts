type VoiceType = 'us' | 'uk'

let activeAudio: HTMLAudioElement | null = null

export const playYoudaoVoice = async (
  text: string,
  voiceType: VoiceType,
  volume = 1
): Promise<void> => {
  const content = text.trim()
  if (!content) return

  const encoded = encodeURIComponent(content)
  const type = voiceType === 'us' ? 2 : 1
  const url = `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${type}`

  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }

  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, volume))
  activeAudio = audio

  try {
    await audio.play()
  } catch (error) {
    // Silence errors as requested (e.g. 500 from API or AbortError)
  }
}

export const stopYoudaoVoice = (): void => {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
}
