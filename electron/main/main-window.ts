import {
  app, BrowserWindow,
} from 'electron'
import { join } from 'node:path'
import { createWindowOptions } from '@electron/main/window-factory'

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
}

export function createMainWindowHost(options: MainWindowOptions): MainWindowHost {
  let mainWindow: BrowserWindow | null = null

  async function createWindow(): Promise<void> {
    const windowOptions = createWindowOptions({ preloadPath: options.preloadPath })
    mainWindow = new BrowserWindow(windowOptions)

    mainWindow.once('ready-to-show', (): void => {
      mainWindow?.show()
    })

    mainWindow.on('closed', (): void => {
      mainWindow = null
    })

    if (options.isDev && options.devRendererUrl) {
      await mainWindow.loadURL(options.devRendererUrl)
    } else if (process.env.ELECTRON_SMOKE_TEST) {
      await mainWindow.loadFile(join(options.distElectronDir, 'smoke.html'))
    } else {
      await mainWindow.loadFile(join(app.getAppPath(), '.output/public/index.html'))
    }
  }

  function focusOrRestore(): void {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }

  return {
    getWindow: (): BrowserWindow | null => mainWindow,
    createWindow,
    focusOrRestore,
  }
}
