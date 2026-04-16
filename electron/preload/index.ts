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

const allowedChannels = new Set<string>(Object.values(channels))

async function invoke<Name extends ChannelName>(
  channel: Name,
  ...args: ChannelRequest<Name> extends void ? [] : [ChannelRequest<Name>]
): Promise<ChannelResponse<Name>> {
  if (!allowedChannels.has(channel)) {
    throw new Error(`preload: channel "${channel}" is not registered`)
  }

  return ipcRenderer.invoke(channel, ...args) as Promise<ChannelResponse<Name>>
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
} as const

export type OpenTranslateApi = typeof api

contextBridge.exposeInMainWorld('api', api)
