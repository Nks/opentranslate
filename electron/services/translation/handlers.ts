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

      const adapter = descriptor.createAdapter({
        settings: providerSettings,
        getSecret: async () => deps.vault.getMainOnly(providerId),
      })

      deps.orchestrator.setAdapter(adapter)

      const languages = await deps.catalog.refreshLanguages(adapter)
      const capabilities = await adapter.getCapabilities()
      const selection = deps.catalog.revalidateSelection(
        deps.currentSelection(),
        languages,
      )

      return {
        languages,
        capabilities,
        selection,
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
