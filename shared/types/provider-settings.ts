export type GoogleEdition = 'basic' | 'advanced'

export interface GoogleProviderSettings {
  enabled: boolean
  projectId: string
  credentialsJsonPath: string
  edition: GoogleEdition
  location: string | null
  requestTimeoutMs: number
}

export interface LibreTranslateProviderSettings {
  enabled: boolean
  endpoint: string
  apiKey: string | null
  requestTimeoutMs: number
  allowSelfSignedTls: boolean
}

export interface ProviderSettingsMap {
  google: GoogleProviderSettings
  libretranslate: LibreTranslateProviderSettings
}
