/**
 * IPC safe-handler utilities extracted from main/index.ts.
 *
 * `serialize` strips frozen arrays, getters, and symbols so Electron's
 * structured clone never chokes. `safeHandler` wraps any IPC callback
 * with serialization and error normalisation.
 */

/**
 * Force a value through a JSON round-trip so Electron's structured clone
 * never chokes on frozen arrays, getters, or symbols.
 */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Wrap an IPC handler so:
 * 1. Return values are serialized (no clone errors).
 * 2. Thrown errors are caught and re-thrown as a plain `Error` with full
 *    details in the message (so Electron can clone them and the renderer
 *    sees useful error text, not "An object could not be cloned").
 *
 * @param fn   - The actual handler implementation.
 * @param isDev - When `true`, stack traces are appended to the error detail.
 */
export function safeHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>,
  isDev = false,
): (...args: TArgs) => Promise<unknown> {
  return async (...args: TArgs) => {
    try {
      const result = await fn(...args)

      if (result === undefined || result === null) {
        return result
      }

      return serialize(result)
    } catch (err) {
      const message = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err)
      const category = (err as { category?: string }).category ?? 'unknown'
      const detail = isDev
        ? `[${category}] ${message}\n${(err as Error).stack ?? ''}`
        : `[${category}] ${message}`

      throw new Error(detail)
    }
  }
}
