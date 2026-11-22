export const MAX_AUDIO_NAME_LENGTH = 255

export interface SelectedAudioFile {
  token: string
  fileName: string
  defaultName: string
}

export interface AudioResourceDetails {
  name: string
  category: string
}
