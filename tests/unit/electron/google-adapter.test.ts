import {
  describe, expect, it,
} from 'vitest'
import {
  createGoogleAdapter,
} from '@electron/providers/google/adapter'
import type {
  FetchLike,
} from '@electron/providers/google/http-client'
import type {
  GoogleAuthProvider,
} from '@electron/providers/google/auth'
import type {
  GoogleProviderSettings,
} from '@shared/types/provider-settings'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const BASE_SETTINGS: GoogleProviderSettings = {
  enabled: true,
  projectId: 'test-project',
  credentialsJsonPath: '/tmp/fake-creds.json',
  edition: 'basic',
  location: null,
  requestTimeoutMs: 5_000,
}

const FAKE_AUTH: GoogleAuthProvider = {
  getAccessToken: async () => 'fake-token',
  getProjectId: async () => 'test-project',
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
    const call: FetchCall = {
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
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

describe('Google adapter', () => {
  const noSecret = async (): Promise<string | null> => null

  it('lists supported languages via v2 /languages with Bearer token', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [
            {
              language: 'en',
              name: 'English',
            },
            {
              language: 'de',
              name: 'German',
            },
          ],
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })
    const languages = await adapter.getSupportedLanguages()

    expect(languages).toHaveLength(2)
    expect(calls[0]?.url).toContain('/language/translate/v2/languages')
    expect(calls[0]?.headers.Authorization).toBe('Bearer fake-token')
  })

  it('translates text with explicit source', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          translations: [
            {
              translatedText: 'hallo',
              detectedSourceLanguage: 'en',
            },
          ],
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })
    const out = await adapter.translateText({
      text: 'hello',
      source: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'de',
    })

    expect(out.translatedText).toBe('hallo')
    expect(out.provider).toBe('google')
    expect(calls[0]?.body).toContain('q=hello')
    expect(calls[0]?.body).toContain('target=de')
    expect(calls[0]?.body).toContain('source=en')
  })

  it('omits source param when selection is auto', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          translations: [
            {
              translatedText: 'hallo',
            },
          ],
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })
    await adapter.translateText({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    expect(calls[0]?.body).not.toContain('source=')
  })

  it('detects language via v2 /detect', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          detections: [
            [
              {
                language: 'fr',
                confidence: 0.88,
              },
            ],
          ],
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })
    const result = await adapter.detectLanguage('bonjour')

    expect(result.detectedLanguage).toBe('fr')
    expect(result.confidence).toBe(0.88)
  })

  it('maps 401 response to AuthenticationFailure', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 401,
      body: {
        error: {
          status: 'UNAUTHENTICATED',
          message: 'missing token',
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })

    try {
      await adapter.getSupportedLanguages()
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })

  it('reports health based on listLanguages success', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [],
        },
      },
    }))
    const adapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })
    const health = await adapter.getHealth()

    expect(health.ok).toBe(true)
  })

  it('reports document translation only for Advanced edition with location', async () => {
    const {
      fetch,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [],
        },
      },
    }))
    const basicAdapter = createGoogleAdapter({
      settings: BASE_SETTINGS,
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })

    expect(await basicAdapter.supportsDocumentTranslation()).toBe(false)

    const advancedAdapter = createGoogleAdapter({
      settings: {
        ...BASE_SETTINGS,
        edition: 'advanced',
        location: 'us-central1',
      },
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })

    expect(await advancedAdapter.supportsDocumentTranslation()).toBe(true)

    const advancedNoLocation = createGoogleAdapter({
      settings: {
        ...BASE_SETTINGS,
        edition: 'advanced',
        location: null,
      },
      getSecret: noSecret,
      authProvider: FAKE_AUTH,
      fetchImpl: fetch,
    })

    expect(await advancedNoLocation.supportsDocumentTranslation()).toBe(false)
  })
})
