/**
 * Sound effects utility using Web Audio API
 * Generates simple tones for feedback without external files
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

interface ToneOptions {
  frequency: number
  duration: number
  type: OscillatorType
  volume?: number
}

function playTone({ frequency, duration, type, volume = 0.3 }: ToneOptions): void {
  const ctx = getAudioContext()

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.frequency.value = frequency
  oscillator.type = type

  // Fade in/out to prevent clicks
  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + duration)
}

/**
 * Play a success/correct sound
 * A pleasant ascending two-tone chime
 */
export function playCorrectSound(): void {
  getAudioContext()

  // First tone
  playTone({ frequency: 523.25, duration: 0.1, type: 'sine', volume: 0.25 }) // C5

  // Second tone (slightly delayed, higher pitch)
  setTimeout(() => {
    playTone({ frequency: 659.25, duration: 0.15, type: 'sine', volume: 0.25 }) // E5
  }, 80)
}

/**
 * Play an error/wrong sound
 * A short descending buzz
 */
export function playWrongSound(): void {
  playTone({ frequency: 200, duration: 0.15, type: 'sawtooth', volume: 0.15 })
}

/**
 * Play a keystroke sound
 * A subtle click
 */
export function playKeystrokeSound(): void {
  const ctx = getAudioContext()

  // Create a short noise burst for a click sound
  const bufferSize = ctx.sampleRate * 0.02 // 20ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1))
  }

  const source = ctx.createBufferSource()
  const gainNode = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  source.buffer = buffer
  filter.type = 'highpass'
  filter.frequency.value = 1000

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)

  gainNode.gain.value = 0.08

  source.start()
}

/**
 * Play a completion/celebration sound
 * A triumphant ascending arpeggio
 */
export function playCompleteSound(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  const duration = 0.12

  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone({ frequency: freq, duration: duration + 0.05, type: 'sine', volume: 0.2 })
    }, i * 100)
  })
}

/**
 * Play a skip sound
 * A quick descending slide
 */
export function playSkipSound(): void {
  const ctx = getAudioContext()

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(600, ctx.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1)

  gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.1)
}

// Sound settings
let soundEnabled = true

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export async function resumeAudioContext(): Promise<void> {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume()
  }
}

// Wrapper functions that respect sound settings
export const sound = {
  correct: () => soundEnabled && playCorrectSound(),
  wrong: () => soundEnabled && playWrongSound(),
  keystroke: () => soundEnabled && playKeystrokeSound(),
  complete: () => soundEnabled && playCompleteSound(),
  skip: () => soundEnabled && playSkipSound(),
  resume: () => resumeAudioContext()
}
