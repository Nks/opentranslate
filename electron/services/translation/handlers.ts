import type {
  TranslationOrchestrator,
} from '@electron/services/translation/orchestrator'
import type {
  LanguageCatalog, LanguageSelection,
} from '@electron/services/language-catalog/catalog'
import type {
  SettingsStore,
} from '@electron/services/settings/store'
import type {
  SecretsVault,
} from '@electron/services/secrets/vault'
import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'
import type {
  Language,
} from '@shared/types/language'
import type {
  ProviderCapabilities,
} from '@shared/types/capabilities'
import type {
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
  SourceLanguageSelection,
} from '@shared/types/translation'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

export interface ProviderSwitchResponse {
  languages: Language[]
  capabilities: ProviderCapabilities
  selection: {
    source: SourceLanguageSelection
    target: string | null
  }
  error: string | null
}

export interface TranslationHandlers {
  'provider:switch': (input: {
    providerId: string
  }) => Promise<ProviderSwitchResponse>
  'translation:translate': (input: TranslationInput) => Promise<TranslationOutput | null>
  'translation:cancel': () => void
  'translation:detect': (input: {
    text: string
  }) => Promise<LanguageDetectionResult>
  'language:list': (input: {
    providerId: string
  }) => Promise<Language[]>
}

export interface TranslationHandlerDeps {
  orchestrator: TranslationOrchestrator
  catalog: LanguageCatalog
  store: SettingsStore
  vault: SecretsVault
  getDescriptor: (providerId: string) => ProviderDescriptor | undefined
  currentSelection: () => LanguageSelection
}

export function createTranslationHandlers(
  deps: TranslationHandlerDeps,
): TranslationHandlers {
  return {
    'provider:switch': async ({
      providerId,
    }) => {
      const descriptor = deps.getDescriptor(providerId)

      if (!descriptor) {
        throw new AppError(
          ErrorCategory.InternalAppError,
          `unknown provider "${providerId}"`,
        )
      }

      const settings = await deps.store.load()
      const providerSettings = settings.providers[providerId] ?? descriptor.defaultSettings

      // Registry guarantees `secretFields.length <= 1` (see
      // `electron/providers/registry.ts`); the vault stores plaintext keyed
      // by `providerId` alone. Only return the value when the adapter asks
      // for the declared secret field — every other key returns `null` so
      // an adapter typo cannot silently land on the wrong slot.
      const expectedSecretFieldKey: string | null =
        descriptor.secretFields[0]?.key ?? null

      const adapter = descriptor.createAdapter({
        settings: providerSettings,
        getSecret: async (fieldKey: string): Promise<string | null> => {
          if (expectedSecretFieldKey === null || fieldKey !== expectedSecretFieldKey) {
            return null
          }

          return deps.vault.getMainOnly(providerId)
        },
      })

      deps.orchestrator.setAdapter(adapter)

      // Attempt to connect. If it fails (wrong endpoint, auth, network),
      // still activate the provider so the user can fix settings — but
      // return the error so the UI can show it.
      let languages: Language[] = []
      let capabilities: ProviderCapabilities = {
        textTranslation: false,
        languageDetection: false,
        supportedLanguagesDiscovery: false,
        documentTranslation: false,
      }
      let connectionError: string | null = null

      try {
        languages = await deps.catalog.refreshLanguages(adapter)
        capabilities = await adapter.getCapabilities()
      } catch (err) {
        connectionError = err instanceof Error ? err.message : String(err)
      }

      const selection = deps.catalog.revalidateSelection(
        deps.currentSelection(),
        languages,
      )

      return {
        languages,
        capabilities,
        selection,
        error: connectionError,
      }
    },

    'translation:translate': async (input) => {
      return deps.orchestrator.translate(input)
    },

    'translation:cancel': () => {
      deps.orchestrator.cancel()
    },

    'translation:detect': async ({
      text,
    }) => {
      return deps.orchestrator.detect(text)
    },

    'language:list': async ({
      providerId,
    }) => {
      const cached = deps.catalog.getLanguages(providerId)

      if (cached.length > 0) {
        return cached
      }

      const adapter = deps.orchestrator.getAdapter()

      if (adapter?.id === providerId) {
        return deps.catalog.refreshLanguages(adapter)
      }

      return []
    },
  }
}
