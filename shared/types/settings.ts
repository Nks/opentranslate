import type {
  SourceLanguageSelection,
} from './translation'

export type ThemePreference = 'system' | 'light' | 'dark'
export type HistoryRetentionMode = 'forever' | 'last-30-days' | 'last-100-entries'
export type CloseBehavior = 'ask' | 'hide' | 'quit'

export interface ShortcutsSettings {
  quickTranslate: string
  openMain: string
  quickTranslateEnabled: boolean
}

export interface AdvancedSettings {
  requestTimeoutMs: number
}

export interface ActiveProviderSelection {
  providerId: string | null
  sourceSelection: SourceLanguageSelection
  targetLanguage: string | null
}

export const TARGET_HISTORY_MAX = 5

export interface AppSettings {
  launchAtStartup: boolean
  theme: ThemePreference
  defaultTargetLanguage: string | null
  debounceMs: number
  historyEnabled: boolean
  historyRetentionMode: HistoryRetentionMode
  showTray: boolean
  closeBehavior: CloseBehavior
  shortcuts: ShortcutsSettings
  advanced: AdvancedSettings
  activeProvider: ActiveProviderSelection
  targetHistory: string[]
}
