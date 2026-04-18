import {
  app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, session, shell, systemPreferences,
} from 'electron'
import {
  join,
} from 'node:path'
import {
  createWindowOptions,
} from '@electron/main/window-factory'
import {
  createQuickTranslateController,
  type QuickTranslateController,
} from '@electron/main/quick-translate-controller'
import {
  channels,
} from '@electron/ipc/channels'
import {
  createSettingsStore,
  type SettingsStore,
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
import {
  safeHandler as _safeHandler,
} from '@electron/services/ipc/safe-handler'
import {
  defaultAppSettings,
} from '@shared/schemas/settings'

const DEV_RENDERER_URL = process.env.ELECTRON_RENDERER_URL
const IS_DEV = Boolean(DEV_RENDERER_URL)

/** Bind `IS_DEV` so callers do not have to pass it on every registration. */
function safeHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return _safeHandler(fn, IS_DEV)
}

const distElectronDir = app.getAppPath()
const preloadPath = join(distElectronDir, 'preload.cjs')

let mainWindow: BrowserWindow | null = null
let settingsHandlers: SettingsAndSecretsHandlers | null = null
let translationHandlers: TranslationHandlers | null = null
let historyHandlers: HistoryHandlers | null = null
let quickTranslateController: QuickTranslateController | null = null

function registerIpcHandlers(): SettingsStore {
  bootstrapProviderRegistry()

  ipcMain.handle(channels['app:get-version'], safeHandler(() => app.getVersion()))
  ipcMain.handle(channels['app:get-platform'], safeHandler(() => process.platform))
  ipcMain.handle(channels['providers:list'], safeHandler(() => listProviderDtos()))

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

  ipcMain.handle(channels['settings:get'], safeHandler(
    () => settingsHandlers!['settings:get'](),
  ))
  ipcMain.handle(channels['settings:update'], safeHandler(
    async (_event: unknown, patch: unknown) => {
      const result = await settingsHandlers!['settings:update'](patch as {
        app?: Record<string, unknown>
        providers?: Record<string, unknown>
      })

      quickTranslateController?.applyFromSettings(result.app.shortcuts.quickTranslate)

      return result
    },
  ))
  ipcMain.handle(channels['secrets:set'], safeHandler(
    (_event: unknown, input: unknown) => settingsHandlers!['secrets:set'](input as {
      providerId: string
      secret: string
    }),
  ))
  ipcMain.handle(channels['secrets:test'], safeHandler(
    (_event: unknown, input: unknown) => settingsHandlers!['secrets:test'](input as { providerId: string }),
  ))

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

  ipcMain.handle(channels['provider:switch'], safeHandler(
    async (_event: unknown, input: unknown) => {
      const result = await translationHandlers!['provider:switch'](input as { providerId: string })
      currentSelection = result.selection

      return result
    },
  ))
  ipcMain.handle(channels['translation:translate'], safeHandler(
    (_event: unknown, input: unknown) => translationHandlers!['translation:translate'](input as Parameters<TranslationHandlers['translation:translate']>[0]),
  ))
  ipcMain.handle(channels['translation:cancel'], safeHandler(
    () => translationHandlers!['translation:cancel'](),
  ))
  ipcMain.handle(channels['translation:detect'], safeHandler(
    (_event: unknown, input: unknown) => translationHandlers!['translation:detect'](input as { text: string }),
  ))
  ipcMain.handle(channels['language:list'], safeHandler(
    (_event: unknown, input: unknown) => translationHandlers!['language:list'](input as { providerId: string }),
  ))

  try {
    const historyDb = createHistoryStore(join(userDataDir, 'history.db'))
    historyHandlers = createHistoryHandlers({
      history: historyDb,
      settings: store,
    })
  } catch {
    // better-sqlite3 native module may fail if not rebuilt for Electron ABI.
  }

  ipcMain.handle(channels['history:add'], safeHandler(
    (_event: unknown, input: unknown) => historyHandlers?.['history:add'](input as Parameters<NonNullable<typeof historyHandlers>['history:add']>[0]) ?? null,
  ))
  ipcMain.handle(channels['history:list'], safeHandler(
    (_event: unknown, input: unknown) => historyHandlers?.['history:list'](input as {
      limit?: number
      offset?: number
    }) ?? [],
  ))
  ipcMain.handle(channels['history:search'], safeHandler(
    (_event: unknown, input: unknown) => historyHandlers?.['history:search'](input as {
      query: string
      limit?: number
    }) ?? [],
  ))
  ipcMain.handle(channels['history:delete'], safeHandler(
    (_event: unknown, input: unknown) => {
      historyHandlers?.['history:delete'](input as { id: string })

      return null
    },
  ))
  ipcMain.handle(channels['history:clear'], safeHandler(
    () => historyHandlers?.['history:clear'](),
  ))
  ipcMain.handle(channels['history:toggle'], safeHandler(
    (_event: unknown, input: unknown) => historyHandlers?.['history:toggle'](input as { enabled: boolean }),
  ))

  // Document channels — capability check + file pick + translate.
  // Actual document translation is stubbed until Google v3 Advanced lands.
  ipcMain.handle(channels['document:status'], safeHandler(() => {
    const adapter = orchestrator.getAdapter()

    if (!adapter) {
      return {
        supported: false,
        message: 'No provider selected',
      }
    }

    return adapter.supportsDocumentTranslation().then((supported) => ({
      supported,
      message: supported
        ? 'Document translation available'
        : 'Document translation not supported by this provider',
    }))
  }))
  ipcMain.handle(channels['document:pick'], safeHandler(async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Documents',
          extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'html'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return { filePath: result.filePaths[0] }
  }))
  ipcMain.handle(channels['document:translate'], safeHandler(
    async (_event: unknown, _input: unknown) => {
      throw new Error('Document translation not yet implemented (Phase 9 stub)')
    },
  ))

  return store
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
    // Nuxt needs 'unsafe-inline' for hydration scripts.
    // Vite dev needs 'unsafe-eval' for HMR + source maps.
    // The real security boundary is contextIsolation + sandbox + no
    // nodeIntegration, not CSP.
    const csp = IS_DEV
      ? [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${DEV_RENDERER_URL ?? ''}`,
          `style-src 'self' 'unsafe-inline' ${DEV_RENDERER_URL ?? ''}`,
          `connect-src 'self' ${DEV_RENDERER_URL ?? ''} ws://localhost:*`,
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

/**
 * Prompt the user to grant Accessibility permission on macOS and open the
 * relevant System Settings pane.
 *
 * Returns true if permission was already granted. A false return means the
 * user was shown a dialog and will need to relaunch the app.
 */
function ensureAccessibilityPermission(): boolean {
  if (process.platform !== 'darwin') {
    return true
  }

  const trusted = systemPreferences.isTrustedAccessibilityClient(false)

  if (trusted) {
    return true
  }

  void dialog
    .showMessageBox({
      type: 'info',
      title: 'Accessibility permission required',
      message: 'Enable the Cmd+C+C quick translate shortcut',
      detail:
        'OpenTranslate Desktop needs Accessibility permission to detect the ' +
        'Cmd+C+C chord anywhere on your Mac. Open System Settings → ' +
        'Privacy & Security → Accessibility, enable OpenTranslate Desktop, ' +
        'then relaunch the app.',
      buttons: ['Open System Settings', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        // Triggers the native prompt and opens the Accessibility pane.
        systemPreferences.isTrustedAccessibilityClient(true)
        void shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
        )
      }
    })

  return false
}

function buildQuickTranslateController(): QuickTranslateController {
  return createQuickTranslateController({
    platform: process.platform,
    ensureAccessibilityPermission,
    readClipboardText: () => clipboard.readText(),
    sendTextToMainWindow: (text) => {
      if (!mainWindow) {
        return
      }

      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('quick-translate:text', text)
    },
    showWarning: (input) => {
      void dialog.showMessageBox({
        type: 'warning',
        title: input.title,
        message: input.message,
        detail: input.detail,
        buttons: ['OK'],
      })
    },
    logger: (message, err) => {
      // eslint-disable-next-line no-console
      console.error(message, err)
    },
    onAppExit: (listener) => {
      app.on('will-quit', listener)
    },
  })
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

  app.whenReady().then(async () => {
    if (!process.env.ELECTRON_SMOKE_TEST) {
      setContentSecurityPolicy()
    }

    const store = registerIpcHandlers()
    void createMainWindow()

    let accelerator = defaultAppSettings.shortcuts.quickTranslate

    try {
      const loaded = await store.load()
      accelerator = loaded.app.shortcuts.quickTranslate
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[shortcuts] failed to load settings; using default accelerator', err)
    }

    quickTranslateController = buildQuickTranslateController()
    quickTranslateController.start(accelerator)
  })
}

bootstrap()
