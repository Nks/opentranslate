import {
  afterEach, describe, expect, it,
} from 'vitest'
import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  Agent, FormData, type Dispatcher, type RequestInit as UndiciRequestInit,
} from 'undici'
import {
  createProviderHttp,
  type FetchLike,
  type ProviderHttp,
} from '@electron/services/http/provider-http'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const BASE_URL = 'https://libre.test/api'

interface RecordedCall {
  url: string
  init: UndiciRequestInit | undefined
}

function errorMapper(status: number, body: unknown): never {
  throw new AppError(ErrorCategory.InvalidProviderResponse, `mapped ${status}: ${String(body)}`)
}

function recordingFetch(respond: () => Response): {
  fetchImpl: FetchLike
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []
  const fetchImpl: FetchLike = async (input: string | URL, init?: UndiciRequestInit) => {
    calls.push({
      url: String(input),
      init,
    })

    return respond()
  }

  return {
    fetchImpl,
    calls,
  }
}

function buildHttp(fetchImpl: FetchLike): ProviderHttp {
  return createProviderHttp({
    providerId: 'test',
    baseUrl: BASE_URL,
    timeoutMs: 5_000,
    errorMapper,
    authHeader: async (): Promise<Record<string, string>> => ({ Authorization: 'Bearer secret' }),
    fetchImpl,
  })
}

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller: ReadableStreamDefaultController<Uint8Array>): void {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

async function expectCategory(promise: Promise<unknown>, category: string): Promise<AppError> {
  const err: unknown = await promise.then(
    (): never => {
      throw new Error('expected rejection')
    },
    (rejection: unknown): unknown => rejection,
  )

  expect(err).toBeInstanceOf(AppError)
  expect((err as AppError).category).toBe(category)

  return err as AppError
}

describe('provider http execute — multipart + hardening', () => {
  it('passes FormData through untouched and lets fetch set the multipart boundary', async () => {
    const {
      fetchImpl, calls,
    } = recordingFetch(() => Response.json({ ok: true }))
    const form: FormData = new FormData()
    form.set('source', 'auto')

    await buildHttp(fetchImpl).execute({
      path: '/translate_file',
      method: 'POST',
      body: form,
      redirect: 'manual',
    })

    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(calls[0]?.init?.body).toBe(form)
    expect(headers['Content-Type']).toBeUndefined()
    expect(calls[0]?.init?.redirect).toBe('manual')
  })

  it('maps a malformed JSON success body to InvalidProviderResponse', async () => {
    const { fetchImpl } = recordingFetch(() => new Response('<html>', { status: 200 }))

    await expectCategory(
      buildHttp(fetchImpl).execute({
        path: '/translate_file',
        method: 'POST',
      }),
      ErrorCategory.InvalidProviderResponse,
    )
  })
})

describe('provider http download', () => {
  it('fetches a same-origin URL without credentials or redirects and returns the bytes', async () => {
    const {
      fetchImpl, calls,
    } = recordingFetch(() => new Response(new Uint8Array([1, 2, 3])))
    const bytes: Uint8Array = await buildHttp(fetchImpl).download({
      url: 'https://libre.test/download_file/abc.report.pdf',
      maxBytes: 10,
    })

    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(Array.from(bytes)).toEqual([1, 2, 3])
    expect(calls[0]?.url).toBe('https://libre.test/download_file/abc.report.pdf')
    expect(calls[0]?.init?.method).toBe('GET')
    expect(calls[0]?.init?.redirect).toBe('manual')
    expect(headers.Authorization).toBeUndefined()
  })

  it.each([
    ['another host', 'https://evil.test/download_file/x'],
    ['a sibling subdomain', 'https://api.libre.test/download_file/x'],
    ['a downgraded scheme', 'http://libre.test/download_file/x'],
    ['another port', 'https://libre.test:8443/download_file/x'],
    ['a file URL', 'file:///etc/passwd'],
    ['a relative URL', '/download_file/x'],
    ['an unparseable URL', 'not a url'],
  ])('refuses %s without making a request', async (_label: string, url: string) => {
    const {
      fetchImpl, calls,
    } = recordingFetch(() => new Response(new Uint8Array([1])))

    await expectCategory(
      buildHttp(fetchImpl).download({
        url,
        maxBytes: 10,
      }),
      ErrorCategory.InvalidProviderResponse,
    )
    expect(calls).toHaveLength(0)
  })

  it('does not follow a redirect and routes it through the error mapper', async () => {
    const { fetchImpl } = recordingFetch(() => new Response(null, {
      status: 302,
      headers: { Location: 'https://evil.test/steal' },
    }))
    const err: AppError = await expectCategory(
      buildHttp(fetchImpl).download({
        url: 'https://libre.test/download_file/x',
        maxBytes: 10,
      }),
      ErrorCategory.InvalidProviderResponse,
    )

    expect(err.message).toContain('mapped 302')
  })

  it('rejects a declared Content-Length above the cap', async () => {
    const { fetchImpl } = recordingFetch(() => new Response(streamOf([new Uint8Array(4)]), {
      headers: { 'Content-Length': '4096' },
    }))
    const err: AppError = await expectCategory(
      buildHttp(fetchImpl).download({
        url: 'https://libre.test/download_file/x',
        maxBytes: 1024,
      }),
      ErrorCategory.InvalidProviderResponse,
    )

    expect(err.message).toContain('1024')
  })

  it('stops reading a streamed body once it exceeds the cap', async () => {
    const { fetchImpl } = recordingFetch(() => new Response(streamOf([
      new Uint8Array(6),
      new Uint8Array(6),
    ])))

    await expectCategory(
      buildHttp(fetchImpl).download({
        url: 'https://libre.test/download_file/x',
        maxBytes: 10,
      }),
      ErrorCategory.InvalidProviderResponse,
    )
  })

  it('wraps a transport failure as EndpointUnreachable', async () => {
    const fetchImpl: FetchLike = async (): Promise<Response> => {
      throw new TypeError('fetch failed')
    }

    await expectCategory(
      buildHttp(fetchImpl).download({
        url: 'https://libre.test/download_file/x',
        maxBytes: 10,
      }),
      ErrorCategory.EndpointUnreachable,
    )
  })

  it('wraps a body stream failure as EndpointUnreachable', async () => {
    const failing: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>({
      pull(controller: ReadableStreamDefaultController<Uint8Array>): void {
        controller.error(new Error('socket hang up'))
      },
    })
    const { fetchImpl } = recordingFetch(() => new Response(failing))

    await expectCategory(
      buildHttp(fetchImpl).download({
        url: 'https://libre.test/download_file/x',
        maxBytes: 10,
      }),
      ErrorCategory.EndpointUnreachable,
    )
  })
})

describe('provider http download — dispatcher reuse', () => {
  let server: Server | null = null

  afterEach(async () => {
    await new Promise<void>((resolve: () => void) => {
      if (!server) {
        resolve()

        return
      }
      server.close((): void => resolve())
    })
    server = null
  })

  it('downloads through the configured dispatcher (allowSelfSignedTls agent path)', async () => {
    server = createServer((_req: IncomingMessage, res: ServerResponse): void => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.end(Buffer.from('translated'))
    })
    await new Promise<void>((resolve: () => void) => {
      server?.listen(0, '127.0.0.1', resolve)
    })
    const port: number = (server.address() as AddressInfo).port
    let dispatched: number = 0

    class CountingAgent extends Agent {
      override dispatch(
        options: Dispatcher.DispatchOptions,
        handler: Dispatcher.DispatchHandler,
      ): boolean {
        dispatched += 1

        return super.dispatch(options, handler)
      }
    }

    const http: ProviderHttp = createProviderHttp({
      providerId: 'test',
      baseUrl: `http://127.0.0.1:${port}`,
      timeoutMs: 5_000,
      errorMapper,
      dispatcher: new CountingAgent(),
    })
    const bytes: Uint8Array = await http.download({
      url: `http://127.0.0.1:${port}/download_file/x`,
      maxBytes: 1024,
    })

    expect(Buffer.from(bytes).toString('utf8')).toBe('translated')
    expect(dispatched).toBe(1)
  })
})
