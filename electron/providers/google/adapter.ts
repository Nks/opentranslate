import {
  createGoogleHttpClient,
  type FetchLike,
} from '@electron/providers/google/http-client'
import {
  createDefaultGoogleAuth,
  type GoogleAuthProvider,
  type DefaultGoogleAuthInput,
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
   * google-auth-library-backed provider for `authMode === 'service-account'`,
   * or an api-key-backed provider for `authMode === 'api-key'`.
   */
  authProvider?: GoogleAuthProvider
  fetchImpl?: FetchLike
}

const PROVIDER_ID: ProviderId = 'google'

async function resolveAuthInput(
  settings: GoogleProviderSettings,
  getSecret: (fieldKey: string) => Promise<string | null>,
): Promise<DefaultGoogleAuthInput> {
  if (settings.authMode === 'api-key') {
    const vaultKey: string | null = await getSecret('apiKey')
    const inlineKey: string = settings.apiKey ?? ''
    const apiKey: string = (vaultKey !== null && vaultKey.length > 0)
      ? vaultKey
      : inlineKey

    return {
      authMode: 'api-key',
      apiKey,
      projectId: settings.projectId,
    }
  }

  return {
    authMode: 'service-account',
    credentialsJsonPath: settings.credentialsJsonPath,
  }
}

export function createGoogleAdapter(deps: GoogleAdapterDeps): TranslationProvider {
  type GoogleClient = ReturnType<typeof createGoogleHttpClient>
  let cachedClient: GoogleClient | null = null

  async function getClient(): Promise<GoogleClient> {
    if (cachedClient !== null) {
      return cachedClient
    }
    const auth: GoogleAuthProvider = deps.authProvider ??
      createDefaultGoogleAuth(await resolveAuthInput(deps.settings, deps.getSecret))
    cachedClient = createGoogleHttpClient({
      settings: deps.settings,
      auth,
      ...(deps.fetchImpl
        ? {
            fetchImpl: deps.fetchImpl,
          }
        : {}),
    })

    return cachedClient
  }

  async function getHealth(): Promise<HealthStatus> {
    try {
      const client: GoogleClient = await getClient()
      await client.listLanguages()

      return {
        ok: true,
      }
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err)

      return {
        ok: false,
        details: message,
      }
    }
  }

  async function supportsDocumentTranslation(): Promise<boolean> {
    // TODO: re-enable once the v3 Advanced document flow lands
    // (architecture §8.2.5 / §8.7.1 — currently a "not yet implemented"
    // stub). Reporting `true` based on configuration alone would expose
    // a fake capability per AGENTS.md provider rule 6: the Documents
    // page would enable, the user would click "Translate", and the call
    // would throw. Keep this `false` for every auth mode until the real
    // v3 document endpoint is wired up.
    return false
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
    getSupportedLanguages: async () => (await getClient()).listLanguages(),
    detectLanguage: async (text) => (await getClient()).detect(text),
    translateText: async (input) => (await getClient()).translate(input),
    supportsDocumentTranslation,
    getCapabilities,
  }
}
