import {
  app, BrowserWindow, ipcMain, safeStorage, session,
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
  getProvider,
} from '@electron/providers'
import {
  createTranslationOrchestrator,
} from '@electron/services/translation/orchestrator'
import {
  createLanguageCatalog,
} from '@electron/services/language-catalog/catalog'
import {
  createTranslationHandlers,
  type TranslationHandlers,
} from '@electron/services/translation/handlers'
import type {
  LanguageSelection,
} from '@electron/services/language-catalog/catalog'
import {
  createHistoryStore,
} from '@electron/services/history/store'
import {
  createHistoryHandlers,
  type HistoryHandlers,
} from '@electron/services/history/handlers'

const DEV_RENDERER_URL = process.env.ELECTRON_RENDERER_URL
const IS_DEV = Boolean(DEV_RENDERER_URL)

const distElectronDir = app.getAppPath()
const preloadPath = join(distElectronDir, 'preload.cjs')

let mainWindow: BrowserWindow | null = null
let settingsHandlers: SettingsAndSecretsHandlers | null = null
let translationHandlers: TranslationHandlers | null = null
let historyHandlers: HistoryHandlers | null = null

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

  const orchestrator = createTranslationOrchestrator()
  const catalog = createLanguageCatalog()
  let currentSelection: LanguageSelection = {
    source: {
      mode: 'auto',
    },
    target: null,
  }

  translationHandlers = createTranslationHandlers({
    orchestrator,
    catalog,
    store,
    vault,
    getDescriptor: getProvider,
    currentSelection: () => currentSelection,
  })

  ipcMain.handle(channels['provider:switch'], async (_event, input) => {
    const result = await translationHandlers!['provider:switch'](input)
    currentSelection = result.selection

    return result
  })
  ipcMain.handle(
    channels['translation:translate'],
    (_event, input) => translationHandlers!['translation:translate'](input),
  )
  ipcMain.handle(
    channels['translation:cancel'],
    () => translationHandlers!['translation:cancel'](),
  )
  ipcMain.handle(
    channels['translation:detect'],
    (_event, input) => translationHandlers!['translation:detect'](input),
  )
  ipcMain.handle(
    channels['language:list'],
    (_event, input) => translationHandlers!['language:list'](input),
  )

  try {
    const historyDb = createHistoryStore(join(userDataDir, 'history.db'))
    historyHandlers = createHistoryHandlers({
      history: historyDb,
      settings: store,
    })
  } catch {
    // better-sqlite3 native module may fail if not rebuilt for Electron ABI.
    // History features will be unavailable; the rest of the app still works.
  }

  ipcMain.handle(channels['history:add'], (_event, input) => historyHandlers?.['history:add'](input) ?? null)
  ipcMain.handle(channels['history:list'], (_event, input) => historyHandlers?.['history:list'](input) ?? [])
  ipcMain.handle(channels['history:search'], (_event, input) => historyHandlers?.['history:search'](input) ?? [])
  ipcMain.handle(channels['history:delete'], (_event, input) => historyHandlers?.['history:delete'](input))
  ipcMain.handle(channels['history:clear'], () => historyHandlers?.['history:clear']())
  ipcMain.handle(channels['history:toggle'], (_event, input) => historyHandlers?.['history:toggle'](input))
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

function setContentSecurityPolicy(): void {
  try {
    const csp = IS_DEV
      ? [
          "default-src 'self'",
          `script-src 'self' ${DEV_RENDERER_URL ?? ''}`,
          `style-src 'self' 'unsafe-inline' ${DEV_RENDERER_URL ?? ''}`,
          `connect-src 'self' ${DEV_RENDERER_URL ?? ''} ws://localhost:*`,
          "img-src 'self' data:",
          "font-src 'self' data:",
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
        ].join('; ')

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
  } catch {
    // CSP setup may fail in test environments
  }
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
    if (!process.env.ELECTRON_SMOKE_TEST) {
      setContentSecurityPolicy()
    }

    registerIpcHandlers()
    void createMainWindow()
  })
}

bootstrap()
