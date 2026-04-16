import {
  createGoogleHttpClient,
  type FetchLike,
} from '@electron/providers/google/http-client'
import {
  createDefaultGoogleAuth,
  type GoogleAuthProvider,
} from '@electron/providers/google/auth'
import type {
  TranslationProvider,
} from '@shared/providers/contract'
import type {
  ProviderAdapterDeps,
} from '@shared/providers/descriptor'
import type {
  GoogleProviderSettings,
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

export interface GoogleAdapterDeps extends ProviderAdapterDeps<GoogleProviderSettings> {
  /**
   * Injected auth provider (test override). Defaults to the real
   * google-auth-library-backed provider that reads the service-account
   * JSON file from `settings.credentialsJsonPath`.
   */
  authProvider?: GoogleAuthProvider
  fetchImpl?: FetchLike
}

const PROVIDER_ID: ProviderId = 'google'

export function createGoogleAdapter(deps: GoogleAdapterDeps): TranslationProvider {
  const auth = deps.authProvider ?? createDefaultGoogleAuth({
    credentialsJsonPath: deps.settings.credentialsJsonPath,
  })
  const client = createGoogleHttpClient({
    settings: deps.settings,
    auth,
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
    // Google Cloud Translation document translation requires v3 Advanced
    // (see architecture §8.2.5). Full v3 flow lands in Phase 9. Until then,
    // Basic edition always returns false, Advanced returns false too and
    // surfaces a clear "configure Advanced + document path to come" gate.
    return deps.settings.edition === 'advanced' && deps.settings.location !== null
  }

  async function getCapabilities(): Promise<ProviderCapabilities> {
    return {
      textTranslation: true,
      languageDetection: true,
      supportedLanguagesDiscovery: true,
      documentTranslation: await supportsDocumentTranslation(),
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
