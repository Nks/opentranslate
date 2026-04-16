import type {
  AppSettings,
} from '@shared/types/settings'
import type {
  ProviderDescriptorDto,
} from '@shared/providers/descriptor'
import type {
  SettingsUpdate,
} from '@electron/services/settings/store'
import type {
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
} from '@shared/types/translation'
import type {
  Language,
} from '@shared/types/language'
import type {
  ProviderCapabilities,
} from '@shared/types/capabilities'
import type {
  SourceLanguageSelection,
} from '@shared/types/translation'

/**
 * IPC channel registry — single source of truth for main ↔ renderer messaging.
 *
 * Architecture rule (see docs/architecture.md §7): every main ↔ renderer
 * message must go through a channel declared here. The preload bridge
 * forwards only the channels listed in this registry.
 *
 * Security rule (see docs/architecture.md §8.1): there is no `secrets:get`
 * channel. Main-process code that needs to use a secret must read it via
 * the secrets vault directly, never through an IPC handler.
 */

export const channels = {
  'app:get-version': 'app:get-version',
  'app:get-platform': 'app:get-platform',
  'providers:list': 'providers:list',
  'provider:switch': 'provider:switch',
  'settings:get': 'settings:get',
  'settings:update': 'settings:update',
  'secrets:set': 'secrets:set',
  'secrets:test': 'secrets:test',
  'translation:translate': 'translation:translate',
  'translation:cancel': 'translation:cancel',
  'translation:detect': 'translation:detect',
  'language:list': 'language:list',
} as const

export type ChannelName = keyof typeof channels

export interface SettingsGetResponseShape {
  app: AppSettings
  providers: Record<string, unknown>
}

export interface SecretsSetRequestShape {
  providerId: string
  secret: string
}

export interface SecretsSetResponseShape {
  stored: boolean
  ephemeral: boolean
}

export interface SecretsTestRequestShape {
  providerId: string
}

export interface SecretsTestResponseShape {
  present: boolean
  lastUpdated: string | null
}

export interface ProviderSwitchRequestShape {
  providerId: string
}

export interface ProviderSwitchResponseShape {
  languages: Language[]
  capabilities: ProviderCapabilities
  selection: {
    source: SourceLanguageSelection
    target: string | null
  }
}

export interface LanguageListRequestShape {
  providerId: string
}

export interface TranslationDetectRequestShape {
  text: string
}

export interface ChannelContract {
  'app:get-version': {
    request: void
    response: string
  }
  'app:get-platform': {
    request: void
    response: NodeJS.Platform
  }
  'providers:list': {
    request: void
    response: readonly ProviderDescriptorDto[]
  }
  'provider:switch': {
    request: ProviderSwitchRequestShape
    response: ProviderSwitchResponseShape
  }
  'settings:get': {
    request: void
    response: SettingsGetResponseShape
  }
  'settings:update': {
    request: SettingsUpdate
    response: SettingsGetResponseShape
  }
  'secrets:set': {
    request: SecretsSetRequestShape
    response: SecretsSetResponseShape
  }
  'secrets:test': {
    request: SecretsTestRequestShape
    response: SecretsTestResponseShape
  }
  'translation:translate': {
    request: TranslationInput
    response: TranslationOutput | null
  }
  'translation:cancel': {
    request: void
    response: void
  }
  'translation:detect': {
    request: TranslationDetectRequestShape
    response: LanguageDetectionResult
  }
  'language:list': {
    request: LanguageListRequestShape
    response: Language[]
  }
}

export type ChannelRequest<Name extends ChannelName> = ChannelContract[Name]['request']
export type ChannelResponse<Name extends ChannelName> = ChannelContract[Name]['response']
