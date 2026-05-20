import {
  app, BrowserWindow,
  type Event,
} from 'electron'
import { createWindowOptions } from '@electron/main/window-factory'
import { isDevToolsShortcut } from '@electron/main/devtools-blocker'
import {
  handleMainWindowClose,
  type CloseHandlerDeps,
} from '@electron/main/main-window-close'
import { resolveRuntimePaths } from '@electron/main/runtime-paths'

export interface MainWindowHost {
  getWindow: () => BrowserWindow | null
  createWindow: () => Promise<void>
  focusOrRestore: () => void
}

export interface MainWindowOptions {
  preloadPath: string
  isDev: boolean
  devRendererUrl: string | undefined
  distElectronDir: string
  closeHandlerDeps: CloseHandlerDeps
}

export function createMainWindowHost(options: MainWindowOptions): MainWindowHost {
  let mainWindow: BrowserWindow | null = null

  async function createWindow(): Promise<void> {
    const allowDevTools = !app.isPackaged
    const windowOptions = createWindowOptions({
      preloadPath: options.preloadPath,
      allowDevTools,
    })
    mainWindow = new BrowserWindow(windowOptions)

    if (!allowDevTools) {
      mainWindow.webContents.on('before-input-event', (event, input) => {
        if (isDevToolsShortcut(input)) {
          event.preventDefault()
        }
      })
      mainWindow.webContents.on('devtools-opened', (): void => {
        mainWindow?.webContents.closeDevTools()
      })
    }

    mainWindow.once('ready-to-show', (): void => {
      mainWindow?.show()
    })

    mainWindow.on('close', (event: Event): void => {
      if (!mainWindow) {
        return
      }
      handleMainWindowClose(event, options.closeHandlerDeps, mainWindow)
    })

    mainWindow.on('closed', (): void => {
      mainWindow = null
    })

    const paths = resolveRuntimePaths(options.distElectronDir)

    if (options.isDev && options.devRendererUrl) {
      await mainWindow.loadURL(options.devRendererUrl)
    } else if (process.env.ELECTRON_SMOKE_TEST) {
      await mainWindow.loadFile(paths.smokeEntry)
    } else {
      await mainWindow.loadFile(paths.rendererEntry)
    }
  }

  function focusOrRestore(): void {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  }

  return {
    getWindow: (): BrowserWindow | null => mainWindow,
    createWindow,
    focusOrRestore,
  }
}
