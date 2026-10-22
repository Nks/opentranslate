import {
  createLibreHttpClient, type FetchLike,
} from '@electron/providers/libretranslate/http-client'
import type {
  TranslationProvider,
} from '@shared/providers/contract'
import type {
  ProviderAdapterDeps,
} from '@shared/providers/descriptor'
import type {
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'
import type {
  ProviderCapabilities,
} from '@shared/types/capabilities'
import type {
  HealthStatus,
} from '@shared/types/health'
import type {
  ProviderId,
} from '@shared/types/provider-id'

export interface LibreAdapterDeps extends ProviderAdapterDeps<LibreTranslateProviderSettings> {
  fetchImpl?: FetchLike
}

const PROVIDER_ID: ProviderId = 'libretranslate'

export function createLibreTranslateAdapter(deps: LibreAdapterDeps): TranslationProvider {
  const client = createLibreHttpClient({
    settings: deps.settings,
    getSecret: deps.getSecret,
    ...(deps.fetchImpl
      ? {
          fetchImpl: deps.fetchImpl,
        }
      : {}),
  })

  async function getHealth(): Promise<HealthStatus> {
    try {
      await client.listLanguages()

      return {
        ok: true,
      }
    } catch (err) {
      return {
        ok: false,
        details: (err as Error).message,
      }
    }
  }

  async function supportsDocumentTranslation(): Promise<boolean> {
    return client.probeDocumentSupport()
  }

  async function getCapabilities(): Promise<ProviderCapabilities> {
    const docs = await client.probeDocumentSupport()

    return {
      textTranslation: true,
      languageDetection: true,
      supportedLanguagesDiscovery: true,
      documentTranslation: docs,
    }
  }

  return {
    id: PROVIDER_ID,
    getHealth,
    getSupportedLanguages: () => client.listLanguages(),
    detectLanguage: (text) => client.detect(text),
    translateText: (input) => client.translate(input),
    supportsDocumentTranslation,
    getCapabilities,
  }
}
