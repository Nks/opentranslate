import {
  Agent, FormData,
} from 'undici'
import {
  createProviderHttp,
  stripTrailingSlash,
  type FetchLike,
} from '@electron/services/http/provider-http'
import {
  mapLibreDetection,
  mapLibreFileFormats,
  mapLibreFileTranslation,
  mapLibreLanguages,
  mapLibreTranslation,
  throwLibreHttpError,
  toLibreSourceCode,
  type LibreNativeDetection,
  type LibreNativeLanguage,
  type LibreNativeTranslation,
} from '@electron/providers/libretranslate/mapper'
import {
  DOCUMENT_REQUEST_TIMEOUT_MS,
  MAX_DOCUMENT_DOWNLOAD_BYTES,
} from '@shared/documents/limits'
import type {
  DocumentBytes,
  DocumentTranslationInput,
} from '@shared/providers/contract'
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
  fetchDocumentFormats: () => Promise<string[]>
  translateFile: (input: DocumentTranslationInput) => Promise<DocumentBytes>
}

interface FormFieldSink {
  set(name: string, value: string): void
}

// Used only when the user opts into `allowSelfSignedTls` for a self-hosted LibreTranslate.
const selfSignedAgent = new Agent({
  // eslint-disable-next-line @stylistic/max-len
  // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification
  connect: {
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

  const documentTimeoutMs: number = Math.max(
    input.settings.requestTimeoutMs,
    DOCUMENT_REQUEST_TIMEOUT_MS,
  )

  async function withApiKey<TFields extends FormFieldSink>(params: TFields): Promise<TFields> {
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
      source: toLibreSourceCode(reqInput.source),
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

  async function fetchDocumentFormats(): Promise<string[]> {
    const native: unknown = await http.executeOrNull<unknown>({
      path: '/frontend/settings',
      method: 'GET',
    })

    return native === null ? [] : mapLibreFileFormats(native)
  }

  async function probeDocumentSupport(): Promise<boolean> {
    try {
      const formats: string[] = await fetchDocumentFormats()

      return formats.length > 0
    } catch {
      return false
    }
  }

  async function translateFile(document: DocumentTranslationInput): Promise<DocumentBytes> {
    const form: FormData = new FormData()
    form.set('file', new Blob([document.content]), document.fileName)
    form.set('source', toLibreSourceCode(document.sourceLanguage))
    form.set('target', document.targetLanguage)
    await withApiKey(form)

    const native: unknown = await http.execute<unknown>({
      path: '/translate_file',
      method: 'POST',
      body: form,
      timeoutMs: documentTimeoutMs,
    })

    return http.download({
      url: mapLibreFileTranslation(native),
      maxBytes: MAX_DOCUMENT_DOWNLOAD_BYTES,
      timeoutMs: documentTimeoutMs,
    })
  }

  return {
    listLanguages,
    detect,
    translate,
    probeDocumentSupport,
    fetchDocumentFormats,
    translateFile,
  }
}
