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

export function createGoogleHttpClient(input: GoogleHttpClientInput): GoogleHttpClient {
  const http = createProviderHttp({
    providerId: 'google',
    baseUrl: V2_BASE,
    timeoutMs: input.settings.requestTimeoutMs,
    dispatcher: strictAgent,
    errorMapper: throwGoogleHttpError,
    authHeader: async () => ({
      Authorization: `Bearer ${await input.auth.getAccessToken()}`,
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
      path: '/languages?target=en',
      method: 'GET',
    })

    return mapGoogleLanguages(native)
  }

  async function detect(text: string): Promise<LanguageDetectionResult> {
    const native = await http.execute<GoogleDetectResponse>({
      path: '/detect',
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
      path: '',
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
