import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { findExecutable } from './whisper'

export async function encodeGeneratedMp3(wav: Uint8Array, signal: AbortSignal): Promise<Buffer> {
  const ffmpeg = findExecutable('ffmpeg')
  if (!ffmpeg) throw new Error('no-ffmpeg')
  const directory = await mkdtemp(join(tmpdir(), 'ultraenglish-mp3-'))
  try {
    const input = join(directory, 'input.wav')
    const output = join(directory, 'output.mp3')
    await writeFile(input, wav)
    // A seekable output lets FFmpeg write the gapless metadata for encoder delay and padding.
    await promisify(execFile)(ffmpeg, [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input,
      '-codec:a', 'libmp3lame', '-b:a', '96k', '-write_xing', '1', output
    ], { windowsHide: true, signal, timeout: 120_000 })
    const mp3 = await readFile(output)
    if (!mp3.byteLength) throw new Error('Empty MP3')
    return mp3
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
