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
} from '@electron/ipc/channels'
import type {
  SettingsUpdate,
} from '@electron/services/settings/store'

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
  settings: {
    get: (): Promise<SettingsGetResponseShape> => invoke('settings:get'),
    update: (patch: SettingsUpdate): Promise<SettingsGetResponseShape> =>
      invoke('settings:update', patch),
  },
  secrets: {
    // Intentional asymmetry: set + test only. There is no secrets.get on the
    // renderer-facing surface (see docs/architecture.md §8.1).
    set: (input: SecretsSetRequestShape): Promise<SecretsSetResponseShape> =>
      invoke('secrets:set', input),
    test: (input: SecretsTestRequestShape): Promise<SecretsTestResponseShape> =>
      invoke('secrets:test', input),
  },
} as const

export type OpenTranslateApi = typeof api

contextBridge.exposeInMainWorld('api', api)
