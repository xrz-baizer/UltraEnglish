import { ipcMain, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { models } from '../db'
import type { AudioGenerationAttributes } from '../db'
import {
  GENERATION_HISTORY_LIMIT, MAX_GENERATION_SAMPLES, isGenerationFormat
} from '../../shared/audio-generation'
import type { GeneratedAudio } from '../../shared/audio-generation'
import { withAudioLibraryCopy } from './audio-storage'

const imports = new Map<string, Promise<string>>()

function describeGeneration(record: AudioGenerationAttributes, importedId?: string): GeneratedAudio {
  return {
    id: record.id,
    name: basename(record.filePath),
    duration: record.duration,
    options: record.options,
    createdAt: record.createdAt.toISOString(),
    importedId
  }
}

export async function recordAudioGeneration(attributes: AudioGenerationAttributes): Promise<GeneratedAudio> {
  return describeGeneration(await models.AudioGeneration.create(attributes))
}

async function getHistory(): Promise<GeneratedAudio[]> {
  const rows = await models.AudioGeneration.findAll({
    attributes: ['id', 'filePath', 'duration', 'options', 'createdAt', 'importedAudioId'],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: GENERATION_HISTORY_LIMIT
  })
  const linkedIds = rows.flatMap((record) => record.importedAudioId ? [record.importedAudioId] : [])
  const library = linkedIds.length ? await models.Audio.findAll({ attributes: ['id'], where: { id: linkedIds } }) : []
  const available = new Set(library.map((audio) => audio.id))
  return rows.map((record) => describeGeneration(record,
    record.importedAudioId && available.has(record.importedAudioId) ? record.importedAudioId : undefined))
}

function checkId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)) {
    throw new Error('Invalid audio ID')
  }
}

async function findGeneration(id: unknown) {
  checkId(id)
  const record = await models.AudioGeneration.findByPk(id)
  if (!record) throw new Error('Generated audio is unavailable')
  return record
}

async function readGeneratedAudio(path: string, size: number): Promise<Uint8Array<ArrayBuffer>> {
  const maxBytes = 44 + MAX_GENERATION_SAMPLES * 2
  if (!Number.isInteger(size) || size < 44 || size > maxBytes) throw new Error('Invalid generated audio size')
  const file = await open(path, 'r')
  try {
    if ((await file.stat()).size !== size) throw new Error('Generated audio changed')
    const bytes = new Uint8Array(size)
    let offset = 0
    while (offset < bytes.byteLength) {
      const { bytesRead } = await file.read(bytes, offset, bytes.byteLength - offset)
      if (!bytesRead) throw new Error('Generated audio changed')
      offset += bytesRead
    }
    return bytes
  } finally {
    await file.close()
  }
}

async function importGeneration(id: string): Promise<string> {
  const record = await findGeneration(id)
  if (record.importedAudioId && await models.Audio.findByPk(record.importedAudioId)) {
    return record.importedAudioId
  }
  const importedId = randomUUID()
  const { format } = record.options
  await withAudioLibraryCopy(importedId, format, record.filePath, async (filePath) => {
    if ((await stat(filePath)).size !== record.size) throw new Error('Generated audio changed')
    await models.Audio.sequelize!.transaction(async (transaction) => {
      await models.Audio.create({
        id: importedId,
        name: basename(record.filePath, `.${format}`),
        category: null,
        filePath,
        format,
        duration: record.duration,
        size: record.size
      }, { transaction })
      await models.Transcription.create({
        id: randomUUID(),
        audioId: importedId,
        engine: 'kokoro',
        language: 'en',
        content: record.content,
        segments: record.segments
      }, { transaction })
      await record.update({ importedAudioId: importedId }, { transaction })
    })
  })
  return importedId
}

export function registerAudioGenerationHistoryHandlers(): void {
  ipcMain.handle('audio-generation-history', getHistory)
  ipcMain.handle('audio-generation-reveal', async (_, id: unknown) => {
    const record = await findGeneration(id)
    await stat(record.filePath)
    shell.showItemInFolder(record.filePath)
  })
  ipcMain.handle('audio-generation-preview', async (_, id: unknown) => {
    const record = await findGeneration(id)
    return readGeneratedAudio(record.filePath, record.size)
  })
  ipcMain.handle('audio-generation-preview-library-audio', async (_, id: unknown) => {
    checkId(id)
    const audio = await models.Audio.findByPk(id)
    if (!audio || !isGenerationFormat(audio.format) || !audio.size) throw new Error('Generated audio is unavailable')
    return readGeneratedAudio(audio.filePath, audio.size)
  })
  ipcMain.handle('audio-generation-import', async (_, id: unknown) => {
    checkId(id)
    const current = imports.get(id)
    if (current) return current
    const job = importGeneration(id)
    imports.set(id, job)
    try {
      return await job
    } finally {
      imports.delete(id)
    }
  })
}
