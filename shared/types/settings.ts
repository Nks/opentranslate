import type { ProviderId } from './provider-id.js';

export type ThemePreference = 'system' | 'light' | 'dark';
export type HistoryRetentionMode = 'forever' | 'last-30-days' | 'last-100-entries';

export interface ShortcutsSettings {
  quickTranslate: string;
  openMain: string;
  quickTranslateEnabled: boolean;
}

export interface AdvancedSettings {
  requestTimeoutMs: number;
  libreAllowSelfSignedTls: boolean;
}

export interface AppSettings {
  launchAtStartup: boolean;
  theme: ThemePreference;
  defaultTargetLanguage: string | null;
  debounceMs: number;
  historyEnabled: boolean;
  historyRetentionMode: HistoryRetentionMode;
  shortcuts: ShortcutsSettings;
  advanced: AdvancedSettings;
  activeProvider: ProviderId;
}
