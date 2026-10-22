import type { BrowserWindowConstructorOptions } from 'electron'

export interface OverlayWindowOptionsInput {
  preloadPath: string
}

/**
 * Pure factory for overlay `BrowserWindow` options.
 *
 * The overlay is a frameless, always-on-top window used for quick
 * translate. It shares the same security settings as the main window
 * (contextIsolation, nodeIntegration off, sandbox).
 */
export function createOverlayWindowOptions(
  input: OverlayWindowOptionsInput,
): BrowserWindowConstructorOptions {
  return {
    width: 480,
    height: 320,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    center: true,
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
