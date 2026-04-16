/**
 * IPC safe-handler utility.
 *
 * Wraps any IPC callback with error normalisation so thrown `AppError`
 * objects (which have non-clonable `cause`) are converted to plain
 * `Error` before crossing the IPC boundary.
 *
 * Return-value serialization was removed — the renderer's `wrapApi()`
 * handles argument serialization, and main-process return values are
 * already plain objects (no Vue reactivity). See B-029.
 */

/**
 * Wrap an IPC handler so thrown errors become plain `Error` objects
 * that Electron's structured clone can transfer to the renderer.
 *
 * @param fn    The actual handler implementation.
 * @param isDev When `true`, stack traces are appended to the error detail.
 */
export function safeHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>,
  isDev = false,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args)
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
