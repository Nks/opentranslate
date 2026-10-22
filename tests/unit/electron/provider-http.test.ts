import {
  describe, expect, it,
} from 'vitest'
import {
  createProviderHttp,
  composeAbortSignal,
  stripTrailingSlash,
  type FetchLike,
} from '@electron/services/http/provider-http'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `test ${status}`,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('createProviderHttp', () => {
  const dummyErrorMapper = (status: number, body: unknown): never => {
    throw new AppError(ErrorCategory.InvalidProviderResponse, `test error ${status}: ${JSON.stringify(body)}`)
  }

  it('sends GET with correct URL, headers, and accept', async () => {
    let capturedUrl = ''
    let capturedInit: Record<string, unknown> = {}
    const fetchImpl: FetchLike = async (url, init) => {
      capturedUrl = String(url)
      capturedInit = init as unknown as Record<string, unknown>

      return fakeResponse(200, {
        ok: true,
      })
    }
    const http = createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper: dummyErrorMapper,
      fetchImpl,
    })
    const result = await http.execute<{
      ok: boolean
    }>({
      path: '/languages',
      method: 'GET',
    })

    expect(capturedUrl).toBe('https://api.example.com/languages')
    expect(capturedInit.method).toBe('GET')
    expect(result.ok).toBe(true)
  })

  it('sends POST with URLSearchParams body and Content-Type header', async () => {
    let capturedBody = ''
    let capturedHeaders: Record<string, string> = {}
    const fetchImpl: FetchLike = async (_url, init) => {
      capturedBody = init?.body as string
      capturedHeaders = init?.headers as Record<string, string>

      return fakeResponse(200, {
        done: true,
      })
    }
    const http = createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper: dummyErrorMapper,
      fetchImpl,
    })
    await http.execute({
      path: '/translate',
      method: 'POST',
      body: new URLSearchParams({
        q: 'hello',
        target: 'de',
      }),
    })

    expect(capturedBody).toContain('q=hello')
    expect(capturedBody).toContain('target=de')
    expect(capturedHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('includes authHeader when provided', async () => {
    let capturedHeaders: Record<string, string> = {}
    const fetchImpl: FetchLike = async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>

      return fakeResponse(200, {})
    }
    const http = createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper: dummyErrorMapper,
      fetchImpl,
      authHeader: async () => ({
        Authorization: 'Bearer test-token',
      }),
    })
    await http.execute({
      path: '/check',
      method: 'GET',
    })

    expect(capturedHeaders.Authorization).toBe('Bearer test-token')
  })

  it('wraps network errors as EndpointUnreachable', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('ECONNREFUSED')
    }
    const http = createProviderHttp({
      providerId: 'myProvider',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper: dummyErrorMapper,
      fetchImpl,
    })

    try {
      await http.execute({
        path: '/check',
        method: 'GET',
      })
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.EndpointUnreachable)
      expect((err as AppError).message).toContain('myProvider')
      expect((err as AppError).message).toContain('ECONNREFUSED')
    }
  })

  it('delegates non-2xx responses to errorMapper with parsed JSON body', async () => {
    const fetchImpl: FetchLike = async () => fakeResponse(403, {
      error: 'forbidden',
    })
    let capturedStatus = 0
    let capturedBody: unknown = null
    const errorMapper = (status: number, body: unknown): never => {
      capturedStatus = status
      capturedBody = body

      throw new AppError(ErrorCategory.AuthenticationFailure, 'denied')
    }
    const http = createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper,
      fetchImpl,
    })

    try {
      await http.execute({
        path: '/check',
        method: 'GET',
      })
      expect.fail('expected throw')
    } catch {
      expect(capturedStatus).toBe(403)
      expect(capturedBody).toEqual({
        error: 'forbidden',
      })
    }
  })

  it('falls back to text body when JSON parsing fails on error response', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 500,
      statusText: 'Error',
      json: async () => {
        throw new Error('not json')
      },
      text: async () => 'Internal Server Error',
    } as unknown as Response)
    let capturedBody: unknown = null
    const errorMapper = (_status: number, body: unknown): never => {
      capturedBody = body

      throw new AppError(ErrorCategory.EndpointUnreachable, 'oops')
    }
    const http = createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      errorMapper,
      fetchImpl,
    })

    try {
      await http.execute({
        path: '/check',
        method: 'GET',
      })
    } catch {
      expect(capturedBody).toBe('Internal Server Error')
    }
  })
})

describe('composeAbortSignal', () => {
  it('returns timeout-only signal when no external signal', () => {
    const signal = composeAbortSignal(undefined, 5000)

    expect(signal).toBeDefined()
    expect(signal.aborted).toBe(false)
  })

  it('returns a combined signal when external signal is provided', () => {
    const controller = new AbortController()
    const signal = composeAbortSignal(controller.signal, 5000)

    expect(signal).toBeDefined()
    expect(signal.aborted).toBe(false)
  })
})

describe('stripTrailingSlash', () => {
  it('strips trailing slash', () => {
    expect(stripTrailingSlash('https://example.com/')).toBe('https://example.com')
  })

  it('leaves clean URL unchanged', () => {
    expect(stripTrailingSlash('https://example.com')).toBe('https://example.com')
  })
})
