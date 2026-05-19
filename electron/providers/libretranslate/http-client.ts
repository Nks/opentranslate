import {
  Agent,
} from 'undici'
import {
  createProviderHttp,
  stripTrailingSlash,
  type FetchLike,
} from '@electron/services/http/provider-http'
import {
  mapLibreDetection,
  mapLibreLanguages,
  mapLibreTranslation,
  throwLibreHttpError,
  type LibreNativeDetection,
  type LibreNativeLanguage,
  type LibreNativeTranslation,
} from '@electron/providers/libretranslate/mapper'
import type {
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'
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

export interface LibreHttpClientInput {
  settings: LibreTranslateProviderSettings
  getSecret: (fieldKey: string) => Promise<string | null>
  fetchImpl?: FetchLike
  abortSignal?: AbortSignal
}

export interface LibreHttpClient {
  listLanguages: () => Promise<Language[]>
  detect: (text: string) => Promise<LanguageDetectionResult>
  translate: (input: TranslationInput) => Promise<TranslationOutput>
  probeDocumentSupport: () => Promise<boolean>
}

const selfSignedAgent = new Agent({
  connect: {
    // nosemgrep: bypass-tls-verification -- opt-in `allowSelfSignedTls`, self-hosted only.
    rejectUnauthorized: false,
  },
})

export function createLibreHttpClient(input: LibreHttpClientInput): LibreHttpClient {
  const http = createProviderHttp({
    providerId: 'libretranslate',
    baseUrl: stripTrailingSlash(input.settings.endpoint),
    timeoutMs: input.settings.requestTimeoutMs,
    errorMapper: throwLibreHttpError,
    ...(input.settings.allowSelfSignedTls
      ? {
          dispatcher: selfSignedAgent,
        }
      : {}),
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

  async function withApiKey(params: URLSearchParams): Promise<URLSearchParams> {
    const apiKey = await input.getSecret('apiKey')

    if (apiKey !== null && apiKey.length > 0) {
      params.set('api_key', apiKey)
    }

    return params
  }

  async function listLanguages(): Promise<Language[]> {
    const native = await http.execute<LibreNativeLanguage[]>({
      path: '/languages',
      method: 'GET',
    })

    return mapLibreLanguages(native)
  }

  async function detect(text: string): Promise<LanguageDetectionResult> {
    const params = await withApiKey(new URLSearchParams({
      q: text,
    }))
    const native = await http.execute<LibreNativeDetection[]>({
      path: '/detect',
      method: 'POST',
      body: params,
    })

    return mapLibreDetection(native)
  }

  async function translate(reqInput: TranslationInput): Promise<TranslationOutput> {
    const params = new URLSearchParams({
      q: reqInput.text,
      source: reqInput.source.mode === 'auto' ? 'auto' : reqInput.source.code,
      target: reqInput.targetLanguage,
      format: reqInput.format ?? 'text',
    })
    await withApiKey(params)
    const native = await http.execute<LibreNativeTranslation>({
      path: '/translate',
      method: 'POST',
      body: params,
    })

    return mapLibreTranslation(native)
  }

  async function probeDocumentSupport(): Promise<boolean> {
    try {
      const settings = await http.execute<{
        supportedFilesFormat?: readonly string[]
      }>({
        path: '/frontend/settings',
        method: 'GET',
      })

      return Array.isArray(settings.supportedFilesFormat) &&
        settings.supportedFilesFormat.length > 0
    } catch {
      return false
    }
  }

  return {
    listLanguages,
    detect,
    translate,
    probeDocumentSupport,
  }
}
