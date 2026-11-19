/** Encode the selected interval as mono PCM so its waveform and seek positions share one timeline. */
export function encodeAudioClip(buffer: AudioBuffer, start: number, end: number): ArrayBuffer {
  const first = Math.max(0, Math.floor(start * buffer.sampleRate))
  const last = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate))
  const length = Math.max(0, last - first)
  const output = new ArrayBuffer(44 + length * 2)
  const view = new DataView(output)
  const write = (offset: number, text: string) =>
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, length * 2, true)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  )
  for (let index = 0; index < length; index++) {
    const sample = Math.max(
      -1,
      Math.min(
        1,
        channels.reduce((sum, channel) => sum + channel[first + index], 0) / channels.length
      )
    )
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
  }
  return output
}
