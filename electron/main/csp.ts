import { session } from 'electron'

export function applyContentSecurityPolicy(options: {
  isDev: boolean
  devRendererUrl: string | undefined
}): void {
  const csp: string = options.isDev
    ? [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${options.devRendererUrl ?? ''}`,
        `style-src 'self' 'unsafe-inline' ${options.devRendererUrl ?? ''}`,
        `connect-src 'self' ${options.devRendererUrl ?? ''} ws://localhost:*`,
        "img-src 'self' data:",
        "font-src 'self' data:",
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
      ].join('; ')

  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback): void => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[main] CSP setup failed', err)
  }
}
