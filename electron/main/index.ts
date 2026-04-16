import {
  app, BrowserWindow, ipcMain, safeStorage,
} from 'electron'
import {
  join,
} from 'node:path'
import {
  createWindowOptions,
} from '@electron/main/window-factory'
import {
  channels,
} from '@electron/ipc/channels'
import {
  createSettingsStore,
} from '@electron/services/settings/store'
import {
  createSecretsVault,
} from '@electron/services/secrets/vault'
import {
  createSettingsAndSecretsHandlers,
  type SettingsAndSecretsHandlers,
} from '@electron/services/settings/handlers'
import {
  bootstrapProviderRegistry,
  listProviders,
  listProviderDtos,
} from '@electron/providers'

const DEV_RENDERER_URL = process.env.ELECTRON_RENDERER_URL
const IS_DEV = Boolean(DEV_RENDERER_URL)

const distElectronDir = app.getAppPath()
const preloadPath = join(distElectronDir, 'preload.cjs')

let mainWindow: BrowserWindow | null = null
let settingsHandlers: SettingsAndSecretsHandlers | null = null

function registerIpcHandlers(): void {
  bootstrapProviderRegistry()

  ipcMain.handle(channels['app:get-version'], () => app.getVersion())
  ipcMain.handle(channels['app:get-platform'], () => process.platform)
  ipcMain.handle(channels['providers:list'], () => listProviderDtos())

  const userDataDir = app.getPath('userData')
  const store = createSettingsStore({
    userDataDir,
    providers: listProviders(),
  })
  const vault = createSecretsVault({
    userDataDir,
    safeStorage,
  })
  settingsHandlers = createSettingsAndSecretsHandlers({
    store,
    vault,
  })

  ipcMain.handle(channels['settings:get'], () => settingsHandlers!['settings:get']())
  ipcMain.handle(
    channels['settings:update'],
    (_event, patch) => settingsHandlers!['settings:update'](patch),
  )
  ipcMain.handle(
    channels['secrets:set'],
    (_event, input) => settingsHandlers!['secrets:set'](input),
  )
  ipcMain.handle(
    channels['secrets:test'],
    (_event, input) => settingsHandlers!['secrets:test'](input),
  )
}

async function createMainWindow(): Promise<void> {
  const options = createWindowOptions({
    preloadPath,
  })
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
