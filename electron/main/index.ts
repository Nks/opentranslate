import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { createWindowOptions } from '@electron/main/window-factory'
import { channels } from '@electron/ipc/channels'

const DEV_RENDERER_URL = process.env.ELECTRON_RENDERER_URL
const IS_DEV = Boolean(DEV_RENDERER_URL)

// `app.getAppPath()` is the directory containing the main entry file.
// In dev + smoke, main.cjs lives in `dist-electron/`, so preload.cjs + smoke.html
// sit alongside it. In packaged builds, electron-builder lays out the same
// directory as the `app` folder inside the asar bundle.
const distElectronDir = app.getAppPath()
const preloadPath = join(distElectronDir, 'preload.cjs')

let mainWindow: BrowserWindow | null = null

function registerIpcHandlers(): void {
  ipcMain.handle(channels['app:get-version'], () => app.getVersion())
  ipcMain.handle(channels['app:get-platform'], () => process.platform)
}

async function createMainWindow(): Promise<void> {
  const options = createWindowOptions({ preloadPath })
  mainWindow = new BrowserWindow(options)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (IS_DEV && DEV_RENDERER_URL) {
    await mainWindow.loadURL(DEV_RENDERER_URL)
  } else if (process.env.ELECTRON_SMOKE_TEST) {
    await mainWindow.loadFile(join(distElectronDir, 'smoke.html'))
  } else {
    await mainWindow.loadFile(join(app.getAppPath(), '.output/public/index.html'))
  }
}

function ensureSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
  return true
}

function bootstrap(): void {
  if (!ensureSingleInstance()) {
    return
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    void createMainWindow()
  })
}

bootstrap()
