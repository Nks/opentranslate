import {
  describe, expect, it, vi, type Mock,
} from 'vitest'
import type { RequestInit as UndiciRequestInit } from 'undici'
import {
  createProviderHttp,
  isSameOrigin,
  type FetchLike,
  type ProviderHttp,
} from '@electron/services/http/provider-http'
import {
  MAX_ERROR_BODY_BYTES,
  MAX_JSON_BODY_BYTES,
} from '@electron/services/http/response-body'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

type ErrorMapper = (status: number, body: unknown) => never

function mapperSpy(): Mock<ErrorMapper> {
  return vi.fn<ErrorMapper>((status: number): never => {
    throw new AppError(ErrorCategory.InvalidProviderResponse, `mapped ${status}`)
  })
}

interface HttpFixture {
  http: ProviderHttp
  inits: Array<UndiciRequestInit | undefined>
}

function httpReturning(
  response: () => Response,
  errorMapper: ErrorMapper = mapperSpy(),
): HttpFixture {
  const inits: Array<UndiciRequestInit | undefined> = []
  const fetchImpl: FetchLike = async (_input: string | URL, init?: UndiciRequestInit) => {
    inits.push(init)

    return response()
  }

  return {
    http: createProviderHttp({
      providerId: 'test',
      baseUrl: 'https://libre.test',
      timeoutMs: 5_000,
      errorMapper,
      fetchImpl,
    }),
    inits,
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  const err: unknown = await promise.then(
    (): never => {
      throw new Error('expected rejection')
    },
    (caught: unknown): unknown => caught,
  )

  expect(err).toBeInstanceOf(AppError)

  return err as AppError
}

describe('provider http — bounded error bodies', () => {
  it('passes a small JSON error body to the mapper', async () => {
    const errorMapper: Mock<ErrorMapper> = mapperSpy()
    const { http }: HttpFixture = httpReturning(() => Response.json({ error: 'bad' }, { status: 400 }), errorMapper)

    await rejectionOf(http.execute({
      path: '/x',
      method: 'GET',
    }))

    expect(errorMapper).toHaveBeenCalledWith(400, { error: 'bad' })
  })

  it('passes a small non-JSON error body as text', async () => {
    const errorMapper: Mock<ErrorMapper> = mapperSpy()
    const { http }: HttpFixture = httpReturning(() => new Response('Bad Gateway', { status: 502 }), errorMapper)

    await rejectionOf(http.execute({
      path: '/x',
      method: 'GET',
    }))

    expect(errorMapper).toHaveBeenCalledWith(502, 'Bad Gateway')
  })

  it('does not read an error body beyond the cap', async () => {
    const errorMapper: Mock<ErrorMapper> = mapperSpy()
    const huge: string = 'x'.repeat(MAX_ERROR_BODY_BYTES + 1)
    const { http }: HttpFixture = httpReturning(
      () => new Response(huge, { status: 500 }),
      errorMapper,
    )

    await rejectionOf(http.execute({
      path: '/x',
      method: 'GET',
    }))

    expect(errorMapper).toHaveBeenCalledWith(500, null)
  })

  it('applies the same cap to download error bodies', async () => {
    const errorMapper: Mock<ErrorMapper> = mapperSpy()
    const huge: string = 'x'.repeat(MAX_ERROR_BODY_BYTES + 1)
    const { http }: HttpFixture = httpReturning(
      () => new Response(huge, { status: 500 }),
      errorMapper,
    )

    await rejectionOf(http.download({
      url: 'https://libre.test/download_file/x',
      maxBytes: 10,
    }))

    expect(errorMapper).toHaveBeenCalledWith(500, null)
  })
})

describe('provider http — bounded JSON', () => {
  it('rejects a success body above the JSON cap', async () => {
    const huge: string = JSON.stringify({ text: 'x'.repeat(MAX_JSON_BODY_BYTES) })
    const { http }: HttpFixture = httpReturning(() => new Response(huge, { status: 200 }))

    const err: AppError = await rejectionOf(http.execute({
      path: '/x',
      method: 'GET',
    }))

    expect(err.category).toBe(ErrorCategory.InvalidProviderResponse)
    expect(err.message).toContain(String(MAX_JSON_BODY_BYTES))
  })

  it('parses a success body within the cap', async () => {
    const { http }: HttpFixture = httpReturning(() => Response.json({ ok: true }))

    expect(await http.execute<{ ok: boolean }>({
      path: '/x',
      method: 'GET',
    })).toEqual({ ok: true })
  })
})

describe('provider http — redirects', () => {
  it('never follows redirects by default', async () => {
    const {
      http, inits,
    } = httpReturning(() => Response.json({ ok: true }))

    await http.execute({
      path: '/translate',
      method: 'POST',
      body: new URLSearchParams({ q: 'x' }),
    })

    expect(inits[0]?.redirect).toBe('manual')
  })

  it.each([301, 302, 307, 308])('normalizes a %i redirect without calling the error mapper', async (status: number) => {
    const errorMapper: Mock<ErrorMapper> = mapperSpy()
    const { http }: HttpFixture = httpReturning(() => new Response(null, {
      status,
      headers: { Location: 'https://evil.test/' },
    }), errorMapper)

    const err: AppError = await rejectionOf(http.execute({
      path: '/translate',
      method: 'POST',
    }))

    expect(err.category).toBe(ErrorCategory.EndpointUnreachable)
    expect(err.message).toContain(`HTTP ${status}`)
    expect(errorMapper).not.toHaveBeenCalled()
  })

  it('normalizes a redirect on download', async () => {
    const { http }: HttpFixture = httpReturning(() => new Response(null, {
      status: 302,
      headers: { Location: 'https://evil.test/' },
    }))

    const err: AppError = await rejectionOf(http.download({
      url: 'https://libre.test/download_file/x',
      maxBytes: 10,
    }))

    expect(err.category).toBe(ErrorCategory.EndpointUnreachable)
  })
})

describe('isSameOrigin', () => {
  it.each([
    ['blob:https://libre.test/8f1c', 'https://libre.test'],
    ['ftp://libre.test/file', 'ftp://libre.test'],
    ['http://libre.test/x', 'https://libre.test'],
  ])('rejects %s against %s', (candidate: string, base: string) => {
    expect(isSameOrigin(candidate, base)).toBe(false)
  })

  it('accepts an http(s) URL on the same origin', () => {
    expect(isSameOrigin('https://libre.test/libre/download_file/x', 'https://libre.test/libre')).toBe(true)
  })
})
