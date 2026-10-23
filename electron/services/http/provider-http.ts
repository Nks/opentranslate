import {
  fetch as undiciFetch,
  type Dispatcher,
  type FormData,
  type RequestInit as UndiciRequestInit,
} from 'undici'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import {
  readBoundedBody, type BoundedBody,
} from '@electron/services/http/bounded-body'

/**
 * Main-process HTTP kernel shared by every provider adapter.
 *
 * Architecture note (docs/architecture.md §8.2.1): transport mechanics
 * (fetch, abort, timeout, dispatcher, response parsing, error wrapping)
 * live here. Each provider's own `http-client.ts` composes this kernel
 * with a provider-specific `errorMapper`, `authHeader`, and endpoint
 * methods while retaining ownership of the high-level API surface.
 */

export type FetchLike = (
  input: string | URL,
  init?: UndiciRequestInit,
) => Promise<Response>

export interface ProviderHttpConfig {
  providerId: string
  baseUrl: string
  timeoutMs: number
  dispatcher?: Dispatcher
  authHeader?: () => Promise<Record<string, string>>
  errorMapper: (status: number, body: unknown) => never
  fetchImpl?: FetchLike
  abortSignal?: AbortSignal
}

export interface ExecuteRequest {
  path: string
  method: 'GET' | 'POST'
  body?: URLSearchParams | FormData
  extraHeaders?: Record<string, string>
  accept?: string
  redirect?: 'follow' | 'manual'
  timeoutMs?: number
}

/**
 * Binary download of a provider-returned URL. The URL must share the
 * kernel's `baseUrl` origin; redirects are never followed and no
 * `authHeader` is attached.
 */
export interface DownloadRequest {
  url: string
  maxBytes: number
  timeoutMs?: number
}

export interface ProviderHttp {
  execute: <T>(req: ExecuteRequest) => Promise<T>
  download: (req: DownloadRequest) => Promise<Uint8Array<ArrayBuffer>>
}

export function composeAbortSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)

  if (!external) {
    return timeout
  }

  if (typeof (AbortSignal as unknown as {
    any?: unknown
  }).any === 'function') {
    return (AbortSignal as unknown as {
      any: (signals: AbortSignal[]) => AbortSignal
    })
      .any([external, timeout])
  }

  return timeout
}

export function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export function isSameOrigin(candidate: string, baseUrl: string): boolean {
  if (!URL.canParse(candidate) || !URL.canParse(baseUrl)) {
    return false
  }

  const candidateOrigin: string = new URL(candidate).origin

  return candidateOrigin !== 'null' && candidateOrigin === new URL(baseUrl).origin
}

export function createProviderHttp(config: ProviderHttpConfig): ProviderHttp {
  const fetchFn: FetchLike = config.fetchImpl ?? ((url, init) => undiciFetch(url, {
    ...(init ?? {}),
    ...(config.dispatcher
      ? {
          dispatcher: config.dispatcher,
        }
      : {}),
  }) as unknown as Promise<Response>)

  async function send(url: string, init: UndiciRequestInit): Promise<Response> {
    try {
      return await fetchFn(url, init)
    } catch (err: unknown) {
      throw new AppError(
        ErrorCategory.EndpointUnreachable,
        `${config.providerId}: network error — ${String((err as Error).message ?? err)}`,
        err,
      )
    }
  }

  async function rejectResponse(response: Response): Promise<never> {
    let body: unknown

    try {
      body = await response.json()
    } catch {
      body = await response.text().catch(() => null)
    }

    return config.errorMapper(response.status, body)
  }

  async function execute<T>(req: ExecuteRequest): Promise<T> {
    const url = `${config.baseUrl}${req.path}`
    const headers: Record<string, string> = {
      Accept: req.accept ?? 'application/json',
      ...(req.extraHeaders ?? {}),
      ...(config.authHeader ? await config.authHeader() : {}),
    }
    const init: UndiciRequestInit = {
      method: req.method,
      headers,
      signal: composeAbortSignal(config.abortSignal, req.timeoutMs ?? config.timeoutMs),
      ...(req.redirect
        ? {
            redirect: req.redirect,
          }
        : {}),
    }

    if (req.body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      init.body = req.body.toString()
    } else if (req.body) {
      init.body = req.body
    }

    const response: Response = await send(url, init)

    if (!response.ok) {
      await rejectResponse(response)
    }

    try {
      return await response.json() as T
    } catch (err: unknown) {
      throw new AppError(
        ErrorCategory.InvalidProviderResponse,
        `${config.providerId}: response body is not valid JSON`,
        err,
      )
    }
  }

  function tooLarge(maxBytes: number): AppError {
    return new AppError(
      ErrorCategory.InvalidProviderResponse,
      `${config.providerId}: downloaded file exceeds ${maxBytes} bytes`,
    )
  }

  async function readDownloadBody(response: Response, maxBytes: number): Promise<BoundedBody> {
    try {
      return await readBoundedBody(response.body, maxBytes)
    } catch (err: unknown) {
      throw new AppError(
        ErrorCategory.EndpointUnreachable,
        `${config.providerId}: download interrupted — ${String((err as Error).message ?? err)}`,
        err,
      )
    }
  }

  async function download(req: DownloadRequest): Promise<Uint8Array<ArrayBuffer>> {
    if (!isSameOrigin(req.url, config.baseUrl)) {
      throw new AppError(
        ErrorCategory.InvalidProviderResponse,
        `${config.providerId}: download URL is not on the configured endpoint origin`,
      )
    }

    const response: Response = await send(req.url, {
      method: 'GET',
      headers: {
        Accept: '*/*',
      },
      redirect: 'manual',
      signal: composeAbortSignal(config.abortSignal, req.timeoutMs ?? config.timeoutMs),
    })

    if (!response.ok) {
      await rejectResponse(response)
    }

    const declaredBytes: number = Number(response.headers.get('content-length'))

    if (declaredBytes > req.maxBytes) {
      await response.body?.cancel()

      throw tooLarge(req.maxBytes)
    }

    const body: BoundedBody = await readDownloadBody(response, req.maxBytes)

    if (body.kind === 'too-large') {
      throw tooLarge(req.maxBytes)
    }

    return body.bytes
  }

  return {
    execute,
    download,
  }
}
