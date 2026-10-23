import {
  describe, expect, it,
} from 'vitest'
import type {
  FormData, RequestInit as UndiciRequestInit,
} from 'undici'
import {
  createLibreTranslateAdapter,
} from '@electron/providers/libretranslate/adapter'
import type {
  FetchLike,
} from '@electron/providers/libretranslate/http-client'
import type {
  DocumentTranslationInput, DocumentTranslationOutput, TranslationProvider,
} from '@shared/providers/contract'
import type {
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import {
  MAX_DOCUMENT_DOWNLOAD_BYTES,
} from '@shared/documents/limits'

const SETTINGS: LibreTranslateProviderSettings = {
  enabled: true,
  endpoint: 'https://libre.test',
  apiKey: null,
  requestTimeoutMs: 5_000,
  allowSelfSignedTls: false,
}

const API_KEY = 'SENSITIVE-FIXTURE-6f1c2a7e-0d41-4b8e'
const TRANSLATED_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x00, 0xff,
])

const DOCUMENT: DocumentTranslationInput = {
  fileName: 'report.pdf',
  content: new Uint8Array([1, 2, 3, 4]),
  sourceLanguage: { mode: 'auto' },
  targetLanguage: 'ru',
}

interface Call {
  url: string
  init: UndiciRequestInit | undefined
}

type Route = (call: Call) => Response

function routedFetch(route: Route): {
  fetchImpl: FetchLike
  calls: Call[]
} {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (input: string | URL, init?: UndiciRequestInit) => {
    const call: Call = {
      url: String(input),
      init,
    }
    calls.push(call)

    return route(call)
  }

  return {
    fetchImpl,
    calls,
  }
}

function libreRoutes(overrides: Partial<Record<'settings' | 'upload' | 'download', () => Response>>): Route {
  return (call: Call): Response => {
    if (call.url.endsWith('/frontend/settings')) {
      return overrides.settings?.() ?? Response.json({
        filesTranslation: true,
        supportedFilesFormat: ['.txt', '.pdf'],
      })
    }

    if (call.url.endsWith('/translate_file')) {
      return overrides.upload?.() ?? Response.json({
        translatedFileUrl: 'https://libre.test/download_file/uuid.report.pdf',
      })
    }

    return overrides.download?.() ?? new Response(TRANSLATED_BYTES)
  }
}

function buildAdapter(
  fetchImpl: FetchLike,
  options: {
    secret?: string | null
    endpoint?: string
  } = {},
): TranslationProvider {
  return createLibreTranslateAdapter({
    settings: {
      ...SETTINGS,
      endpoint: options.endpoint ?? SETTINGS.endpoint,
    },
    getSecret: async (): Promise<string | null> => options.secret ?? null,
    fetchImpl,
  })
}

async function translate(adapter: TranslationProvider): Promise<DocumentTranslationOutput> {
  if (!adapter.translateDocument) {
    throw new Error('adapter must implement translateDocument')
  }

  return adapter.translateDocument(DOCUMENT)
}

async function expectCategory(promise: Promise<unknown>, category: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppError)
  await expect(promise).rejects.toMatchObject({ category })
}

function formOf(call: Call | undefined): FormData {
  return call?.init?.body as FormData
}

describe('LibreTranslate document formats', () => {
  it('reports the normalized supportedFilesFormat list', async () => {
    const { fetchImpl } = routedFetch(libreRoutes({
      settings: () => Response.json({
        filesTranslation: true,
        supportedFilesFormat: ['.TXT', 'pdf'],
      }),
    }))

    expect(await buildAdapter(fetchImpl).getSupportedDocumentFormats?.()).toEqual(['.txt', '.pdf'])
  })

  it('surfaces a failing /frontend/settings as a normalized error', async () => {
    const { fetchImpl } = routedFetch(libreRoutes({
      settings: () => new Response('down', { status: 503 }),
    }))

    await expectCategory(
      buildAdapter(fetchImpl).getSupportedDocumentFormats?.() ?? Promise.resolve(),
      ErrorCategory.EndpointUnreachable,
    )
  })

  it('treats files translation disabled as unsupported', async () => {
    const { fetchImpl } = routedFetch(libreRoutes({
      settings: () => Response.json({
        filesTranslation: false,
        supportedFilesFormat: [],
      }),
    }))

    expect(await buildAdapter(fetchImpl).supportsDocumentTranslation()).toBe(false)
  })
})

describe('LibreTranslate translateDocument', () => {
  it('uploads multipart file/source/target and returns the downloaded bytes unmodified', async () => {
    const {
      fetchImpl, calls,
    } = routedFetch(libreRoutes({}))
    const output: DocumentTranslationOutput = await translate(buildAdapter(fetchImpl))
    const upload: Call | undefined = calls.find((call: Call) => call.url.endsWith('/translate_file'))
    const file = formOf(upload).get('file') as Blob & { name: string }

    expect(upload?.url).toBe('https://libre.test/translate_file')
    expect(upload?.init?.method).toBe('POST')
    expect(upload?.init?.redirect).toBe('manual')
    expect(file.name).toBe('report.pdf')
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([1, 2, 3, 4])
    expect(formOf(upload).get('source')).toBe('auto')
    expect(formOf(upload).get('target')).toBe('ru')
    expect(formOf(upload).has('api_key')).toBe(false)
    expect(calls.at(-1)?.url).toBe('https://libre.test/download_file/uuid.report.pdf')
    expect(output.provider).toBe('libretranslate')
    expect(Array.from(output.content)).toEqual(Array.from(TRANSLATED_BYTES))
  })

  it('forwards an explicit source language code', async () => {
    const {
      fetchImpl, calls,
    } = routedFetch(libreRoutes({}))
    const adapter: TranslationProvider = buildAdapter(fetchImpl)

    await adapter.translateDocument?.({
      ...DOCUMENT,
      sourceLanguage: {
        mode: 'explicit',
        code: 'de',
      },
    })

    const upload: Call | undefined = calls.find((call: Call) => call.url.endsWith('/translate_file'))
    expect(formOf(upload).get('source')).toBe('de')
  })

  it('sends api_key only in the upload form, never on the download request', async () => {
    const {
      fetchImpl, calls,
    } = routedFetch(libreRoutes({}))

    await translate(buildAdapter(fetchImpl, { secret: API_KEY }))

    const upload: Call | undefined = calls.find((call: Call) => call.url.endsWith('/translate_file'))
    const download: Call | undefined = calls.at(-1)
    expect(formOf(upload).get('api_key')).toBe(API_KEY)
    expect(download?.url).not.toContain(API_KEY)
    expect(JSON.stringify(download?.init?.headers ?? {})).not.toContain(API_KEY)
    expect(download?.init?.body).toBeUndefined()
  })

  it('keeps an endpoint path prefix for upload and accepts a download on the same origin', async () => {
    const {
      fetchImpl, calls,
    } = routedFetch(libreRoutes({
      upload: () => Response.json({
        translatedFileUrl: 'https://libre.test/libre/download_file/uuid.report.pdf',
      }),
    }))

    await translate(buildAdapter(fetchImpl, { endpoint: 'https://libre.test/libre/' }))

    expect(calls.map((call: Call) => call.url)).toContain('https://libre.test/libre/translate_file')
    expect(calls.at(-1)?.url).toBe('https://libre.test/libre/download_file/uuid.report.pdf')
  })

  it('refuses a translatedFileUrl on another origin and never contacts it', async () => {
    const {
      fetchImpl, calls,
    } = routedFetch(libreRoutes({
      upload: () => Response.json({
        translatedFileUrl: 'https://attacker.test/download_file/x.pdf',
      }),
    }))

    await expectCategory(
      translate(buildAdapter(fetchImpl, { secret: API_KEY })),
      ErrorCategory.InvalidProviderResponse,
    )
    expect(calls.some((call: Call) => call.url.startsWith('https://attacker.test'))).toBe(false)
  })

  it('rejects an upload response without translatedFileUrl', async () => {
    const { fetchImpl } = routedFetch(libreRoutes({
      upload: () => Response.json({ ok: true }),
    }))

    await expectCategory(translate(buildAdapter(fetchImpl)), ErrorCategory.InvalidProviderResponse)
  })

  it('rejects a download larger than the document download cap', async () => {
    const { fetchImpl } = routedFetch(libreRoutes({
      download: () => new Response(new Uint8Array(1), {
        headers: { 'Content-Length': String(MAX_DOCUMENT_DOWNLOAD_BYTES + 1) },
      }),
    }))

    await expectCategory(translate(buildAdapter(fetchImpl)), ErrorCategory.InvalidProviderResponse)
  })

  it.each([
    [400, 'Invalid request: file format not supported', ErrorCategory.UnsupportedDocumentType],
    [403, 'Files translation are disabled on this server.', ErrorCategory.UnsupportedDocumentType],
    [403, 'Invalid API key', ErrorCategory.AuthenticationFailure],
    [429, 'Too many requests', ErrorCategory.RateLimited],
    [500, 'boom', ErrorCategory.EndpointUnreachable],
  ])('maps upload http %i "%s" to %s', async (status: number, error: string, category: string) => {
    const { fetchImpl } = routedFetch(libreRoutes({
      upload: () => Response.json({ error }, { status }),
    }))

    await expectCategory(translate(buildAdapter(fetchImpl)), category)
  })
})
