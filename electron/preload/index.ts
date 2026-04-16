import {
  contextBridge, ipcRenderer,
} from 'electron'
import {
  channels,
  type ChannelName,
  type ChannelRequest,
  type ChannelResponse,
  type SettingsGetResponseShape,
  type SecretsSetRequestShape,
  type SecretsSetResponseShape,
  type SecretsTestRequestShape,
  type SecretsTestResponseShape,
  type ProviderSwitchRequestShape,
  type ProviderSwitchResponseShape,
  type LanguageListRequestShape,
  type TranslationDetectRequestShape,
} from '@electron/ipc/channels'
import type {
  SettingsUpdate,
} from '@electron/services/settings/store'
import type {
  ProviderDescriptorDto,
} from '@shared/providers/descriptor'
import type {
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
} from '@shared/types/translation'
import type {
  Language,
} from '@shared/types/language'
import type {
  HistoryEntry,
} from '@shared/types/history'
import type {
  HistoryAddRequestShape,
  HistoryListRequestShape,
  HistorySearchRequestShape,
  DocumentPickResponseShape,
  DocumentTranslateRequestShape,
  DocumentTranslateResponseShape,
  DocumentStatusResponseShape,
} from '@electron/ipc/channels'

const allowedChannels = new Set<string>(Object.values(channels))

/**
 * Strip Vue reactive proxies and non-clonable Symbols from IPC arguments.
 * Electron's structured clone algorithm fails on reactive objects.
 */
function stripReactive(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

async function invoke<Name extends ChannelName>(
  channel: Name,
  ...args: ChannelRequest<Name> extends void ? [] : [ChannelRequest<Name>]
): Promise<ChannelResponse<Name>> {
  if (!allowedChannels.has(channel)) {
    throw new Error(`preload: channel "${channel}" is not registered`)
  }

  // Serialize args to strip Vue reactive proxies before IPC transfer
  const safeArgs = args.map(stripReactive) as typeof args

  try {
    return await ipcRenderer.invoke(channel, ...safeArgs) as ChannelResponse<Name>
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error(`[IPC:${channel}]`, message, err)

    throw new Error(`[${channel}] ${message}`)
  }
}

const api = {
  getVersion: (): Promise<string> => invoke('app:get-version'),
  getPlatform: (): Promise<NodeJS.Platform> => invoke('app:get-platform'),
  providers: {
    list: (): Promise<readonly ProviderDescriptorDto[]> => invoke('providers:list'),
    switch: (input: ProviderSwitchRequestShape): Promise<ProviderSwitchResponseShape> =>
      invoke('provider:switch', input),
  },
  settings: {
    get: (): Promise<SettingsGetResponseShape> => invoke('settings:get'),
    update: (patch: SettingsUpdate): Promise<SettingsGetResponseShape> =>
      invoke('settings:update', patch),
  },
  secrets: {
    set: (input: SecretsSetRequestShape): Promise<SecretsSetResponseShape> =>
      invoke('secrets:set', input),
    test: (input: SecretsTestRequestShape): Promise<SecretsTestResponseShape> =>
      invoke('secrets:test', input),
  },
  translation: {
    translate: (input: TranslationInput): Promise<TranslationOutput | null> =>
      invoke('translation:translate', input),
    cancel: (): Promise<void> => invoke('translation:cancel'),
    detect: (input: TranslationDetectRequestShape): Promise<LanguageDetectionResult> =>
      invoke('translation:detect', input),
  },
  languages: {
    list: (input: LanguageListRequestShape): Promise<Language[]> =>
      invoke('language:list', input),
  },
  history: {
    add: (input: HistoryAddRequestShape): Promise<HistoryEntry | null> =>
      invoke('history:add', input),
    list: (input: HistoryListRequestShape): Promise<HistoryEntry[]> =>
      invoke('history:list', input),
    search: (input: HistorySearchRequestShape): Promise<HistoryEntry[]> =>
      invoke('history:search', input),
    delete: (input: { id: string }): Promise<void> =>
      invoke('history:delete', input),
    clear: (): Promise<void> => invoke('history:clear'),
    toggle: (input: { enabled: boolean }): Promise<void> =>
      invoke('history:toggle', input),
  },
  documents: {
    pick: (): Promise<DocumentPickResponseShape | null> =>
      invoke('document:pick'),
    translate: (
      input: DocumentTranslateRequestShape,
    ): Promise<DocumentTranslateResponseShape | null> =>
      invoke('document:translate', input),
    status: (): Promise<DocumentStatusResponseShape> =>
      invoke('document:status'),
  },
  quickTranslate: {
    openFull: (): Promise<void> =>
      invoke('quick-translate:open-full' as never),
    close: (): Promise<void> =>
      invoke('quick-translate:close' as never),
  },
} as const

export type OpenTranslateApi = typeof api

contextBridge.exposeInMainWorld('api', api)
