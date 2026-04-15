/**
 * IPC channel registry — single source of truth for main ↔ renderer messaging.
 *
 * Architecture rule (see docs/architecture.md §7): every main ↔ renderer
 * message must go through a channel declared here. The preload bridge
 * forwards only the channels listed in this registry.
 */

export const channels = {
  'app:get-version': 'app:get-version',
  'app:get-platform': 'app:get-platform',
} as const

export type ChannelName = keyof typeof channels

export interface ChannelContract {
  'app:get-version': {
    request: void
    response: string
  }
  'app:get-platform': {
    request: void
    response: NodeJS.Platform
  }
}

export type ChannelRequest<Name extends ChannelName> = ChannelContract[Name]['request']
export type ChannelResponse<Name extends ChannelName> = ChannelContract[Name]['response']
