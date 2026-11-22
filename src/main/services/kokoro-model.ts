import { net } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { GENERATION_QUALITIES, GENERATION_VOICES, isGenerationQuality } from '../../shared/audio-generation'
import type { GenerationOptions, GenerationResource, GenerationResourceId } from '../../shared/audio-generation'

const MODEL_REVISION = '468588286ebb2dd77c25b9771e5d165896538cce'
const MODEL_BASE_URL = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${MODEL_REVISION}`
const MODELS = {
  q8: {
    path: 'onnx/model_quantized.onnx',
    bytes: 92_361_116,
    sha256: 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478'
  },
  fp32: {
    path: 'onnx/model.onnx',
    bytes: 325_532_232,
    sha256: '8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb'
  }
}
const VOICE_HASHES = {
  af_heart: 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b',
  am_adam: '162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716',
  bf_emma: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73'
}

interface ModelFile {
  id: GenerationResourceId
  path: string
  target: string
  bytes: number
  sha256: string
}

export function kokoroFile(root: string, id: GenerationResourceId): ModelFile {
  if (isGenerationQuality(id)) {
    const model = MODELS[id]
    return { ...model, id, target: join(root, `kokoro-82m-v1.0-${id}`, model.path) }
  }
  // Keep the original Q8 cache as the shared voice store for both model variants.
  const path = `voices/${id}.bin`
  return { id, path, target: join(root, 'kokoro-82m-v1.0-q8', path), bytes: 522_240, sha256: VOICE_HASHES[id] }
}

export function kokoroAssets(root: string, { quality, voice }: GenerationOptions) {
  const model = kokoroFile(root, quality)
  const sound = kokoroFile(root, voice)
  return {
    modelDirectory: dirname(model.target),
    voiceDirectory: dirname(sound.target),
    files: [model, sound]
  }
}

const verifiedFiles = new Map<string, { fingerprint: string; valid: Promise<boolean> }>()

async function isKokoroFileReady(file: ModelFile): Promise<boolean> {
  try {
    const info = await stat(file.target)
    if (!info.isFile() || info.size !== file.bytes) return false
    const fingerprint = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`
    const previous = verifiedFiles.get(file.target)
    if (previous?.fingerprint === fingerprint) return await previous.valid

    const valid = (async () => {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(file.target)) hash.update(chunk)
      return hash.digest('hex') === file.sha256
    })()
    if (verifiedFiles.size >= 32) verifiedFiles.clear()
    verifiedFiles.set(file.target, { fingerprint, valid })
    return await valid
  } catch (error) {
    verifiedFiles.delete(file.target)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function missingKokoroFiles(files: ModelFile[]): Promise<ModelFile[]> {
  const checks = await Promise.all(files.map(async (file) => await isKokoroFileReady(file) ? null : file))
  return checks.filter((file) => file !== null)
}

export async function getKokoroResources(root: string): Promise<GenerationResource[]> {
  const ids = [...GENERATION_QUALITIES, ...Object.keys(GENERATION_VOICES) as (keyof typeof GENERATION_VOICES)[]]
  return Promise.all(ids.map(async (id) => {
    const file = kokoroFile(root, id)
    return { id, bytes: file.bytes, ready: await isKokoroFileReady(file) }
  }))
}

export async function downloadKokoroFiles(
  files: ModelFile[],
  signal: AbortSignal,
  progress: (received: number) => void
) {
  let received = 0
  let lastProgress = 0
  for (const file of files) {
    const { target } = file
    await mkdir(dirname(target), { recursive: true })
    const temporary = `${target}.${randomUUID()}.part`
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15 * 60_000)])
    const hash = createHash('sha256')
    let bytes = 0
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length
        if (bytes > file.bytes) return callback(new Error('Unexpected model file size'))
        hash.update(chunk)
        received += chunk.length
        if (Date.now() - lastProgress >= 100 || bytes === file.bytes) {
          lastProgress = Date.now()
          progress(received)
        }
        callback(null, chunk)
      }
    })
    try {
      const response = await net.fetch(`${MODEL_BASE_URL}/${file.path}`, { signal: requestSignal })
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
        meter,
        createWriteStream(temporary, { flags: 'wx' }),
        { signal: requestSignal }
      )
      if (bytes !== file.bytes || hash.digest('hex') !== file.sha256) {
        throw new Error('Model integrity check failed')
      }
      signal.throwIfAborted()
      await rename(temporary, target)
    } finally {
      await rm(temporary, { force: true })
    }
  }
}
