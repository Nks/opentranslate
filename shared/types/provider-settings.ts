export type GoogleEdition = 'basic' | 'advanced'

export type GoogleAuthMode = 'service-account' | 'api-key'

export interface GoogleProviderSettings {
  enabled: boolean
  authMode: GoogleAuthMode
  projectId: string
  credentialsJsonPath: string
  apiKey: string | null
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
