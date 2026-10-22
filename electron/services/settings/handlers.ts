import type {
  SettingsStore, SettingsUpdate,
} from '@electron/services/settings/store'
import type {
  SecretsVault,
} from '@electron/services/secrets/vault'
import type {
  AppSettings,
} from '@shared/types/settings'

export interface SettingsGetResponse {
  app: AppSettings
  providers: Record<string, unknown>
}

export interface SecretsSetRequest {
  providerId: string
  secret: string
}

export interface SecretsSetResponse {
  stored: boolean
  ephemeral: boolean
}

export interface SecretsTestRequest {
  providerId: string
}

export interface SecretsTestResponse {
  present: boolean
  lastUpdated: string | null
}

export interface SettingsAndSecretsHandlers {
  'settings:get': () => Promise<SettingsGetResponse>
  'settings:update': (patch: SettingsUpdate) => Promise<SettingsGetResponse>
  'settings:reset': () => Promise<SettingsGetResponse>
  'secrets:set': (input: SecretsSetRequest) => Promise<SecretsSetResponse>
  'secrets:test': (input: SecretsTestRequest) => Promise<SecretsTestResponse>
}

export interface HandlerDeps {
  store: SettingsStore
  vault: SecretsVault
}

export function createSettingsAndSecretsHandlers(
  deps: HandlerDeps,
): SettingsAndSecretsHandlers {
  return {
    'settings:get': async () => {
      const file = await deps.store.load()

      return {
        app: file.app,
        providers: file.providers,
      }
    },
    'settings:update': async (patch) => {
      const updated = await deps.store.save(patch)

      return {
        app: updated.app,
        providers: updated.providers,
      }
    },
    'settings:reset': async () => {
      const reset = await deps.store.reset()

      return {
        app: reset.app,
        providers: reset.providers,
      }
    },
    'secrets:set': async ({
      providerId, secret,
    }) => {
      const result = await deps.vault.set(providerId, secret)

      return {
        stored: result.stored,
        ephemeral: result.ephemeral,
      }
    },
    'secrets:test': async ({
      providerId,
    }) => {
      return deps.vault.test(providerId)
    },
  }
}
