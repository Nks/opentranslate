import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  createLibreTranslateAdapter,
} from '@electron/providers/libretranslate/adapter'
import type {
  FetchLike,
} from '@electron/providers/libretranslate/http-client'
import type {
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const SETTINGS: LibreTranslateProviderSettings = {
  enabled: true,
  endpoint: 'https://libre.test',
  apiKey: null,
  requestTimeoutMs: 5_000,
  allowSelfSignedTls: false,
}

interface FetchCall {
  url: string
  method: string
  body: string | undefined
  headers: Record<string, string>
}

function makeFakeFetch(
  handler: (call: FetchCall) => {
    status: number
    body: unknown
  },
): {
  fetch: FetchLike
  calls: FetchCall[]
} {
  const calls: FetchCall[] = []
  const fakeFetch: FetchLike = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const headersInit = (init?.headers ?? {}) as Record<string, string>
    const call: FetchCall = {
      url,
      method,
      body: typeof init?.body === 'string' ? init.body : undefined,
      headers: headersInit,
    }
    calls.push(call)
    const {
      status, body,
    } = handler(call)

    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: `test ${status}`,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as unknown as Response
  }

  return {
    fetch: fakeFetch,
    calls,
  }
}

describe('LibreTranslate adapter', () => {
  let noSecret: () => Promise<string | null>

  beforeEach(() => {
    noSecret = async () => null
  })

  it('lists supported languages via /languages', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: [
        {
          code: 'en',
          name: 'English',
          targets: ['de'],
        },
        {
          code: 'de',
          name: 'German',
          targets: ['en'],
        },
      ],
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const languages = await adapter.getSupportedLanguages()

    expect(languages).toHaveLength(2)
    expect(calls[0]?.url).toBe('https://libre.test/languages')
    expect(calls[0]?.method).toBe('GET')
  })

  it('translates text and forwards source/target/format', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        translatedText: 'hola',
      },
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const result = await adapter.translateText({
      text: 'hello',
      source: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'es',
    })

    expect(result.translatedText).toBe('hola')
    expect(result.provider).toBe('libretranslate')
    expect(calls[0]?.url).toBe('https://libre.test/translate')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toContain('q=hello')
    expect(calls[0]?.body).toContain('source=en')
    expect(calls[0]?.body).toContain('target=es')
    expect(calls[0]?.body).toContain('format=text')
  })

  it('passes source=auto when the selection is auto', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        translatedText: 'hola',
      },
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    await adapter.translateText({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'es',
    })

    expect(calls[0]?.body).toContain('source=auto')
  })

  it('attaches api_key when the vault has one', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        translatedText: 'hola',
      },
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: async () => 'secret-key-value',
      fetchImpl: fetch,
    })
    await adapter.translateText({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'es',
    })

    expect(calls[0]?.body).toContain('api_key=secret-key-value')
  })

  it('maps 401 response to AuthenticationFailure', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 401,
      body: {
        error: 'Invalid API key',
      },
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })

    try {
      await adapter.translateText({
        text: 'x',
        source: {
          mode: 'auto',
        },
        targetLanguage: 'es',
      })
      expect.fail('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })

  it('reports health true when /languages responds', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 200,
      body: [],
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const health = await adapter.getHealth()

    expect(health.ok).toBe(true)
  })

  it('reports health false when /languages fails', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 500,
      body: {
        error: 'boom',
      },
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const health = await adapter.getHealth()

    expect(health.ok).toBe(false)
  })

  it('probes /frontend/settings for document support', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch((call) => {
      if (call.url.endsWith('/frontend/settings')) {
        return {
          status: 200,
          body: {
            supportedFilesFormat: ['pdf', 'docx'],
          },
        }
      }

      return {
        status: 200,
        body: {},
      }
    })
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const supported = await adapter.supportsDocumentTranslation()

    expect(supported).toBe(true)
    expect(calls.some((call) => call.url.endsWith('/frontend/settings'))).toBe(true)
  })

  it('reports document unsupported when /frontend/settings lacks supportedFilesFormat', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {},
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const supported = await adapter.supportsDocumentTranslation()

    expect(supported).toBe(false)
  })

  it('detectLanguage sends POST /detect with form body', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: [
        {
          language: 'en',
          confidence: 0.9,
        },
      ],
    }))
    const adapter = createLibreTranslateAdapter({
      settings: SETTINGS,
      getSecret: noSecret,
      fetchImpl: fetch,
    })
    const detection = await adapter.detectLanguage('hello world')

    expect(detection.detectedLanguage).toBe('en')
    expect(calls[0]?.url).toBe('https://libre.test/detect')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toContain('q=hello+world')
  })
})
