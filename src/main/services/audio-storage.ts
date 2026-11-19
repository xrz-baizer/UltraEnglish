import { app, dialog } from 'electron'
import { access, mkdir } from 'fs/promises'
import { constants } from 'fs'
import { join, isAbsolute } from 'path'
import { randomUUID } from 'crypto'
import { models } from '../db'
import { configureModelDirectory, getUserModelsDir } from './whisper'

export type StorageKind = 'models' | 'audios'
export async function getAudioPreferences(): Promise<Record<string, unknown>> {
  const setting = await models.UserSetting.findOne({ where: { key: 'audio' } })
  return setting ? JSON.parse(setting.value) : {}
}
export async function initializeAudioStorage(): Promise<void> {
  const settings = await getAudioPreferences()
  configureModelDirectory(
    typeof settings.sttModelsDirectory === 'string' ? settings.sttModelsDirectory : ''
  )
}
export async function getAudioStorageDirectory(): Promise<string> {
  const settings = await getAudioPreferences()
  const custom = settings.audioStorageDirectory
  return typeof custom === 'string' && isAbsolute(custom)
    ? custom
    : join(app.getPath('userData'), 'audios')
}
export async function getStoragePaths(): Promise<{ models: string; audios: string }> {
  return { models: getUserModelsDir(), audios: await getAudioStorageDirectory() }
}
export async function chooseStorageDirectory(kind: StorageKind): Promise<string | null> {
  if (kind !== 'models' && kind !== 'audios') throw new Error('Invalid storage kind')
  const paths = await getStoragePaths()
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: paths[kind]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const directory = result.filePaths[0]
  await mkdir(directory, { recursive: true })
  await access(directory, constants.R_OK | constants.W_OK)
  const setting = await models.UserSetting.findOne({ where: { key: 'audio' } })
  const value = setting ? JSON.parse(setting.value) : {}
  value[kind === 'models' ? 'sttModelsDirectory' : 'audioStorageDirectory'] = directory
  if (setting) await setting.update({ value: JSON.stringify(value) })
  else
    await models.UserSetting.create({
      id: randomUUID(),
      key: 'audio',
      value: JSON.stringify(value)
    })
  if (kind === 'models') configureModelDirectory(directory)
  return directory
}
