import {
  describe, expect, it,
} from 'vitest'
import {
  createGoogleHttpClient,
  type FetchLike,
} from '@electron/providers/google/http-client'
import type {
  GoogleAuthProvider,
} from '@electron/providers/google/auth'
import type {
  GoogleProviderSettings,
} from '@shared/types/provider-settings'

const SERVICE_ACCOUNT_SETTINGS: GoogleProviderSettings = {
  enabled: true,
  authMode: 'service-account',
  projectId: 'sa-project',
  credentialsJsonPath: '/tmp/creds.json',
  apiKey: null,
  edition: 'basic',
  location: null,
  requestTimeoutMs: 5_000,
}

const API_KEY_SETTINGS: GoogleProviderSettings = {
  enabled: true,
  authMode: 'api-key',
  projectId: 'apikey-project',
  credentialsJsonPath: '',
  apiKey: 'AIza-test-key',
  edition: 'basic',
  location: null,
  requestTimeoutMs: 5_000,
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

const SA_AUTH: GoogleAuthProvider = {
  getAccessToken: async () => 'sa-token',
  getProjectId: async () => 'sa-project',
  getApiKey: () => null,
}

const API_KEY_AUTH: GoogleAuthProvider = {
  getAccessToken: async () => {
    throw new Error('api-key mode must not issue bearer tokens')
  },
  getProjectId: async () => 'apikey-project',
  getApiKey: () => 'AIza-test-key',
}

describe('Google HTTP client — service-account mode', () => {
  it('sends Authorization: Bearer <token> on listLanguages', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [],
        },
      },
    }))
    const client = createGoogleHttpClient({
      settings: SERVICE_ACCOUNT_SETTINGS,
      auth: SA_AUTH,
      fetchImpl: fetch,
    })
    await client.listLanguages()

    expect(calls[0]?.headers.Authorization).toBe('Bearer sa-token')
    expect(calls[0]?.url).not.toContain('key=')
  })
})

describe('Google HTTP client — api-key mode', () => {
  it('omits the Authorization header when listLanguages is called', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [],
        },
      },
    }))
    const client = createGoogleHttpClient({
      settings: API_KEY_SETTINGS,
      auth: API_KEY_AUTH,
      fetchImpl: fetch,
    })
    await client.listLanguages()

    expect(calls[0]?.headers.Authorization).toBeUndefined()
  })

  it('appends ?key=<APIKEY> to listLanguages URL', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          languages: [],
        },
      },
    }))
    const client = createGoogleHttpClient({
      settings: API_KEY_SETTINGS,
      auth: API_KEY_AUTH,
      fetchImpl: fetch,
    })
    await client.listLanguages()

    expect(calls[0]?.url).toContain('/language/translate/v2/languages')
    expect(calls[0]?.url).toContain('key=AIza-test-key')
  })

  it('appends key=<APIKEY> to /detect URL and omits Authorization', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          detections: [
            [
              {
                language: 'en',
                confidence: 0.9,
              },
            ],
          ],
        },
      },
    }))
    const client = createGoogleHttpClient({
      settings: API_KEY_SETTINGS,
      auth: API_KEY_AUTH,
      fetchImpl: fetch,
    })
    await client.detect('hello')

    expect(calls[0]?.url).toContain('/detect')
    expect(calls[0]?.url).toContain('key=AIza-test-key')
    expect(calls[0]?.headers.Authorization).toBeUndefined()
  })

  it('appends key=<APIKEY> to the translate POST URL', async () => {
    const {
      fetch, calls,
    } = makeFakeFetch(() => ({
      status: 200,
      body: {
        data: {
          translations: [
            { translatedText: 'hallo' },
          ],
        },
      },
    }))
    const client = createGoogleHttpClient({
      settings: API_KEY_SETTINGS,
      auth: API_KEY_AUTH,
      fetchImpl: fetch,
    })
    await client.translate({
      text: 'hello',
      source: { mode: 'auto' },
      targetLanguage: 'de',
    })

    expect(calls[0]?.url).toContain('key=AIza-test-key')
    expect(calls[0]?.headers.Authorization).toBeUndefined()
    expect(calls[0]?.body).toContain('q=hello')
    expect(calls[0]?.body).toContain('target=de')
  })
})
