import type {
  BrowserWindowConstructorOptions,
} from 'electron'

export interface WindowOptionsInput {
  preloadPath: string
}

/**
 * Pure factory for `BrowserWindow` options.
 *
 * All windows in OpenTranslate Desktop must be constructed from these
 * options so the security invariants (see docs/architecture.md §4) are
 * applied uniformly and testable in isolation.
 */
export function createWindowOptions(input: WindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: process.env.NODE_ENV !== 'production',
    },
  }
}
