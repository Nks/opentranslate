import type {
  BrowserWindowConstructorOptions,
} from 'electron'

export interface WindowOptionsInput {
  preloadPath: string
  allowDevTools?: boolean
}

export function createWindowOptions(input: WindowOptionsInput): BrowserWindowConstructorOptions {
  const allowDevTools = input.allowDevTools ?? process.env.NODE_ENV !== 'production'

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
      devTools: allowDevTools,
    },
  }
}
