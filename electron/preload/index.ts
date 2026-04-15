import { contextBridge, ipcRenderer } from 'electron'
import {
  channels,
  type ChannelName,
  type ChannelRequest,
  type ChannelResponse,
} from '@electron/ipc/channels'

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
} as const

export type OpenTranslateApi = typeof api

contextBridge.exposeInMainWorld('api', api)
