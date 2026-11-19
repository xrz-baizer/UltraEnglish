import { app } from 'electron'
import { randomUUID } from 'crypto'
import { copyFile, mkdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { Transaction } from 'sequelize'
import type { TranscriptionSegment } from '../../shared/audio-transcription'
import { getAudioStorageDirectory } from '../services/audio-storage'
import { models } from './index'

const SEED_KEY = 'seed.daily-phrases-1'

export async function seedBuiltInAudio(): Promise<void> {
  const database = models.Audio.sequelize!
  if (await models.UserSetting.findOne({ where: { key: SEED_KEY } })) return

  const source = app.isPackaged ? join(process.resourcesPath, 'audios') : join(app.getAppPath(), 'assets/audios')
  const segments: TranscriptionSegment[] = JSON.parse(await readFile(join(source, 'daily-phrases-1.json'), 'utf8'))
  const directory = await getAudioStorageDirectory()
  const filePath = join(directory, 'builtin-daily-phrases-1.mp3')

  await database.transaction({ type: Transaction.TYPES.IMMEDIATE }, async transaction => {
    if (await models.UserSetting.findOne({ where: { key: SEED_KEY }, transaction })) return
    await mkdir(directory, { recursive: true })
    await copyFile(join(source, 'daily-phrases-1.mp3'), filePath)
    const audio = await models.Audio.create({
      id: randomUUID(), name: '日常高频句子-1', filePath,
      duration: 301.315, size: (await stat(filePath)).size, format: 'mp3'
    }, { transaction })
    await models.Transcription.create({
      id: randomUUID(), audioId: audio.id, language: 'en', engine: 'whisper',
      content: segments.map(segment => segment.text).join(' '), segments: JSON.stringify(segments)
    }, { transaction })
    await models.UserSetting.create({ id: randomUUID(), key: SEED_KEY, value: 'true' }, { transaction })
  })
}
