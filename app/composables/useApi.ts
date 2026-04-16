import type { OpenTranslateApi } from '@electron/preload/index'

/**
 * Deep-wrap an API object so every function call has its arguments
 * JSON-serialized before crossing the Electron context bridge.
 *
 * `contextBridge.exposeInMainWorld` uses structured clone on arguments.
 * Vue reactive objects contain Symbols and getter traps that structured
 * clone cannot handle. This wrapper strips them at the call site.
 *
 * We build a plain object (not a Proxy) because the context bridge
 * freezes properties — Proxy get-traps violate the invariant on
 * non-configurable read-only properties.
 */
function wrapApi<T>(target: T): T {
  if (target === null || typeof target !== 'object') {
    return target
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(target as Record<string, unknown>)) {
    const value = (target as Record<string, unknown>)[key]

    if (typeof value === 'function') {
      result[key] = (...args: unknown[]) => {
        const safeArgs = args.map((arg) =>
          arg === undefined || arg === null
            ? arg
            : JSON.parse(JSON.stringify(arg)),
        )

        return (value as (...params: unknown[]) => unknown)(...safeArgs)
      }
    } else if (value !== null && typeof value === 'object') {
      result[key] = wrapApi(value)
    } else {
      result[key] = value
    }
  }

  return result as T
}

let cached: OpenTranslateApi | null = null

/**
 * Singleton accessor for the Electron IPC bridge exposed via `window.api`.
 *
 * All arguments are deep-serialized through `wrapApi` before crossing the
 * context bridge, stripping Vue reactive proxies and Symbols that
 * structured clone cannot handle.
 *
 * @throws {Error} When called outside Electron (SSR / plain browser).
 */
export function useApi(): OpenTranslateApi {
  if (cached) {
    return cached
  }

  if (typeof window === 'undefined' || !('api' in window)) {
    throw new Error('useApi: window.api is not available outside Electron')
  }

  const raw = (window as unknown as { api: OpenTranslateApi }).api
  cached = wrapApi(raw)

  return cached
}
