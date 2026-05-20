import {
  app, BrowserWindow, clipboard, dialog, ipcMain,
  type IpcMainEvent,
} from 'electron'
import { registerIpcHandlers } from '@electron/main/ipc-setup'
import { createMainWindowHost } from '@electron/main/main-window'
import { resolveRuntimePaths } from '@electron/main/runtime-paths'
import { applyContentSecurityPolicy } from '@electron/main/csp'
import {
  registerRendererProtocol,
  registerRendererSchemePrivileges,
  rendererDirFromEntry,
} from '@electron/main/renderer-protocol'
import { ensureAccessibilityPermission } from '@electron/main/accessibility'
import {
  createQuickTranslateController,
  type QuickTranslateController,
} from '@electron/main/quick-translate-controller'
import {
  createTray, type TrayService,
} from '@electron/main/tray'
import {
  eventChannels,
  type WindowCloseResponsePayload,
} from '@electron/ipc/channels'
import {
  createAppSettingsApplier,
  type AppSettingsApplier,
} from '@electron/main/app-settings-applier'
import { defaultAppSettings } from '@shared/schemas/settings'
import type { CloseBehavior } from '@shared/types/settings'

export type { AppSettingsApplier } from '@electron/main/app-settings-applier'

const DEV_RENDERER_URL: string | undefined = process.env.ELECTRON_RENDERER_URL
const IS_DEV: boolean = Boolean(DEV_RENDERER_URL)
const runtimePaths = resolveRuntimePaths(__dirname)
const SERVE_VIA_PROTOCOL: boolean = !IS_DEV && !process.env.ELECTRON_SMOKE_TEST

if (SERVE_VIA_PROTOCOL) {
  registerRendererSchemePrivileges()
}

let quickTranslateController: QuickTranslateController | null = null
let trayService: TrayService | null = null
let showTray: boolean = defaultAppSettings.showTray
let closeBehavior: CloseBehavior = defaultAppSettings.closeBehavior
let isQuitting: boolean = false

const mainWindowHost = createMainWindowHost({
  preloadPath: runtimePaths.preloadPath,
  isDev: IS_DEV,
  devRendererUrl: DEV_RENDERER_URL,
  distElectronDir: runtimePaths.distElectronDir,
  closeHandlerDeps: {
    getCloseBehavior: (): CloseBehavior => closeBehavior,
    isTrayActive: (): boolean => showTray && trayService !== null,
    isQuitting: (): boolean => isQuitting,
    quit: (): void => {
      isQuitting = true
      app.quit()
    },
  },
})

function ensureSingleInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit()

    return false
  }
  app.on('second-instance', (): void => {
    mainWindowHost.focusOrRestore()
  })

  return true
}

function buildQuickTranslateController(): QuickTranslateController {
  return createQuickTranslateController({
    platform: process.platform,
    ensureAccessibilityPermission,
    readClipboardText: (): string => clipboard.readText(),
    sendTextToMainWindow: (text: string): void => {
      const window = mainWindowHost.getWindow()

      if (!window) {
        return
      }
      mainWindowHost.focusOrRestore()
      window.show()
      window.webContents.send('quick-translate:text', text)
    },
    showWarning: (input: {
      title: string
      message: string
      detail: string
    }): void => {
      void dialog.showMessageBox({
        type: 'warning',
        title: input.title,
        message: input.message,
        detail: input.detail,
        buttons: ['OK'],
      })
    },
    logger: (message: string, err?: unknown): void => {
      // eslint-disable-next-line no-console
      console.error(message, err)
    },
    onAppExit: (listener: () => void): void => {
      app.on('will-quit', listener)
    },
  })
}

function triggerQuickTranslateFromTray(): void {
  const window = mainWindowHost.getWindow()
  const text: string = clipboard.readText().trim()

  if (window) {
    mainWindowHost.focusOrRestore()
    window.show()

    if (text.length > 0) {
      window.webContents.send('quick-translate:text', text)
    }
  }
}

function ensureTray(): void {
  if (trayService !== null) {
    return
  }
  trayService = createTray({
    platform: process.platform,
    iconBaseDir: runtimePaths.trayIconBaseDir,
    onOpen: (): void => {
      mainWindowHost.focusOrRestore()
    },
    onQuickTranslate: triggerQuickTranslateFromTray,
    onQuit: (): void => {
      isQuitting = true
      app.quit()
    },
  })
  trayService.setVisible(true)
}

function teardownTray(): void {
  if (trayService === null) {
    return
  }
  trayService.destroy()
  trayService = null
}

/**
 * Live applier for app-level runtime settings. Called after every
 * `settings:update` / `settings:reset` so toggling `showTray` or
 * `closeBehavior` in the UI takes effect without a restart.
 */
const appSettingsApplier: AppSettingsApplier = createAppSettingsApplier({
  closeBehaviorHolder: {
    get: (): CloseBehavior => closeBehavior,
    set: (next: CloseBehavior): void => {
      closeBehavior = next
    },
  },
  tray: {
    isVisible: (): boolean => showTray && trayService !== null,
    ensure: (): void => {
      showTray = true
      ensureTray()
    },
    teardown: (): void => {
      showTray = false
      teardownTray()
    },
  },
})

function setupTrayCloseResponseListener(): void {
  ipcMain.on(
    eventChannels['window:close-response'],
    (_event: IpcMainEvent, payload: WindowCloseResponsePayload): void => {
      // The renderer is the IPC source; defensively normalize the payload
      // before acting on it. Settings persistence (when remember=true) is
      // handled by the renderer via `settings:update`.
      if (payload?.choice === 'quit') {
        isQuitting = true
        app.quit()

        return
      }

      if (payload?.choice === 'cancel') {
        // User dismissed the dialog (Esc / backdrop). The earlier
        // `close` was already preventDefault'd in the close handler;
        // doing nothing here leaves the window visible. The next close
        // attempt will fire a fresh `window:close-request`.
        return
      }

      const window = mainWindowHost.getWindow()

      if (window) {
        window.hide()
      }
    },
  )
}

function bootstrap(): void {
  if (!ensureSingleInstance()) {
    return
  }

  app.on('window-all-closed', (): void => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', (): void => {
    isQuitting = true
    trayService?.destroy()
    trayService = null
  })

  app.on('activate', (): void => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void mainWindowHost.createWindow()
    } else {
      mainWindowHost.focusOrRestore()
    }
  })

  setupTrayCloseResponseListener()

  void app.whenReady().then(async (): Promise<void> => {
    if (SERVE_VIA_PROTOCOL) {
      registerRendererProtocol(rendererDirFromEntry(runtimePaths.rendererEntry))
    }

    if (!process.env.ELECTRON_SMOKE_TEST) {
      applyContentSecurityPolicy({
        isDev: IS_DEV,
        devRendererUrl: DEV_RENDERER_URL,
      })
    }

    const { store } = registerIpcHandlers({
      isDev: IS_DEV,
      quickTranslateController: (): QuickTranslateController | null => quickTranslateController,
      appSettingsApplier,
    })
    void mainWindowHost.createWindow()

    let accelerator: string = defaultAppSettings.shortcuts.quickTranslate
    let enabled: boolean = defaultAppSettings.shortcuts.quickTranslateEnabled

    try {
      const loaded = await store.load()
      accelerator = loaded.app.shortcuts.quickTranslate
      enabled = loaded.app.shortcuts.quickTranslateEnabled
      showTray = loaded.app.showTray
      closeBehavior = loaded.app.closeBehavior
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[main] failed to load settings; using defaults', err)
    }

    quickTranslateController = buildQuickTranslateController()
    quickTranslateController.start(accelerator, enabled)

    if (showTray) {
      ensureTray()
    }
  })
}

bootstrap()
