import {
  fetch as undiciFetch, type Dispatcher, type RequestInit as UndiciRequestInit,
} from 'undici'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

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
  body?: URLSearchParams
  extraHeaders?: Record<string, string>
  accept?: string
}

export interface ProviderHttp {
  execute: <T>(req: ExecuteRequest) => Promise<T>
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

export function createProviderHttp(config: ProviderHttpConfig): ProviderHttp {
  const fetchFn: FetchLike = config.fetchImpl ?? ((url, init) => undiciFetch(url, {
    ...(init ?? {}),
    ...(config.dispatcher
      ? {
          dispatcher: config.dispatcher,
        }
      : {}),
  }) as unknown as Promise<Response>)

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
      signal: composeAbortSignal(config.abortSignal, config.timeoutMs),
    }

    if (req.body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      init.body = req.body.toString()
    }

    let response: Response

    try {
      response = await fetchFn(url, init)
    } catch (err) {
      throw new AppError(
        ErrorCategory.EndpointUnreachable,
        `${config.providerId}: network error — ${String((err as Error).message ?? err)}`,
        err,
      )
    }

    if (!response.ok) {
      let body: unknown = null

      try {
        body = await response.json()
      } catch {
        body = await response.text().catch(() => null)
      }
      config.errorMapper(response.status, body)
    }

    return response.json() as Promise<T>
  }

  return {
    execute,
  }
}
