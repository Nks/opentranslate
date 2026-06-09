import {
  Agent,
} from 'undici'
import {
  createProviderHttp,
  type FetchLike,
} from '@electron/services/http/provider-http'
import {
  mapGoogleDetection,
  mapGoogleLanguages,
  mapGoogleTranslation,
  throwGoogleHttpError,
  type GoogleDetectResponse,
  type GoogleLanguagesResponse,
  type GoogleTranslateResponse,
} from '@electron/providers/google/mapper'
import type {
  GoogleProviderSettings,
} from '@shared/types/provider-settings'
import type {
  GoogleAuthProvider,
} from '@electron/providers/google/auth'
import type {
  Language,
} from '@shared/types/language'
import type {
  LanguageDetectionResult,
  TranslationInput,
  TranslationOutput,
} from '@shared/types/translation'

export type {
  FetchLike,
}

const V2_BASE = 'https://translation.googleapis.com/language/translate/v2'

const strictAgent = new Agent()

export interface GoogleHttpClientInput {
  settings: GoogleProviderSettings
  auth: GoogleAuthProvider
  fetchImpl?: FetchLike
  abortSignal?: AbortSignal
}

export interface GoogleHttpClient {
  listLanguages: () => Promise<Language[]>
  detect: (text: string) => Promise<LanguageDetectionResult>
  translate: (input: TranslationInput) => Promise<TranslationOutput>
}

/**
 * Append `key=<APIKEY>` to a v2 path while preserving any existing
 * query string (e.g. `?target=en`). Returns the original path when no
 * api key is configured.
 */
function withApiKey(path: string, apiKey: string | null): string {
  if (apiKey === null || apiKey.length === 0) {
    return path
  }

  const separator: string = path.includes('?') ? '&' : '?'
  const encoded: string = encodeURIComponent(apiKey)

  return `${path}${separator}key=${encoded}`
}

export function createGoogleHttpClient(input: GoogleHttpClientInput): GoogleHttpClient {
  const apiKey: string | null = input.auth.getApiKey()
  const isApiKeyMode: boolean = apiKey !== null

  const http = createProviderHttp({
    providerId: 'google',
    baseUrl: V2_BASE,
    timeoutMs: input.settings.requestTimeoutMs,
    dispatcher: strictAgent,
    errorMapper: throwGoogleHttpError,
    ...(isApiKeyMode
      ? {}
      : {
          authHeader: async (): Promise<Record<string, string>> => ({
            Authorization: `Bearer ${await input.auth.getAccessToken()}`,
          }),
        }),
    ...(input.fetchImpl
      ? {
          fetchImpl: input.fetchImpl,
        }
      : {}),
    ...(input.abortSignal
      ? {
          abortSignal: input.abortSignal,
        }
      : {}),
  })

  async function listLanguages(): Promise<Language[]> {
    const native = await http.execute<GoogleLanguagesResponse>({
      path: withApiKey('/languages?target=en', apiKey),
      method: 'GET',
    })

    return mapGoogleLanguages(native)
  }

  async function detect(text: string): Promise<LanguageDetectionResult> {
    const native = await http.execute<GoogleDetectResponse>({
      path: withApiKey('/detect', apiKey),
      method: 'POST',
      body: new URLSearchParams({
        q: text,
      }),
    })

    return mapGoogleDetection(native)
  }

  async function translate(reqInput: TranslationInput): Promise<TranslationOutput> {
    const body = new URLSearchParams({
      q: reqInput.text,
      target: reqInput.targetLanguage,
      format: reqInput.format ?? 'text',
    })

    if (reqInput.source.mode === 'explicit') {
      body.set('source', reqInput.source.code)
    }
    const native = await http.execute<GoogleTranslateResponse>({
      path: withApiKey('', apiKey),
      method: 'POST',
      body,
    })

    return mapGoogleTranslation(native)
  }

  return {
    listLanguages,
    detect,
    translate,
  }
}
