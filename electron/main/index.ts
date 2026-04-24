import {
  app, BrowserWindow, clipboard, dialog,
} from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from '@electron/main/ipc-setup'
import { createMainWindowHost } from '@electron/main/main-window'
import { applyContentSecurityPolicy } from '@electron/main/csp'
import { ensureAccessibilityPermission } from '@electron/main/accessibility'
import {
  createQuickTranslateController,
  type QuickTranslateController,
} from '@electron/main/quick-translate-controller'
import { defaultAppSettings } from '@shared/schemas/settings'

const DEV_RENDERER_URL: string | undefined = process.env.ELECTRON_RENDERER_URL
const IS_DEV: boolean = Boolean(DEV_RENDERER_URL)

let quickTranslateController: QuickTranslateController | null = null

const mainWindowHost = createMainWindowHost({
  preloadPath: join(app.getAppPath(), 'preload.cjs'),
  isDev: IS_DEV,
  devRendererUrl: DEV_RENDERER_URL,
  distElectronDir: app.getAppPath(),
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

function bootstrap(): void {
  if (!ensureSingleInstance()) {
    return
  }

  app.on('window-all-closed', (): void => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', (): void => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void mainWindowHost.createWindow()
    }
  })

  void app.whenReady().then(async (): Promise<void> => {
    if (!process.env.ELECTRON_SMOKE_TEST) {
      applyContentSecurityPolicy({
        isDev: IS_DEV,
        devRendererUrl: DEV_RENDERER_URL,
      })
    }

    const { store } = registerIpcHandlers({
      isDev: IS_DEV,
      quickTranslateController: (): QuickTranslateController | null => quickTranslateController,
    })
    void mainWindowHost.createWindow()

    let accelerator: string = defaultAppSettings.shortcuts.quickTranslate
    let enabled: boolean = defaultAppSettings.shortcuts.quickTranslateEnabled

    try {
      const loaded = await store.load()
      accelerator = loaded.app.shortcuts.quickTranslate
      enabled = loaded.app.shortcuts.quickTranslateEnabled
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[shortcuts] failed to load settings; using default accelerator', err)
    }

    quickTranslateController = buildQuickTranslateController()
    quickTranslateController.start(accelerator, enabled)
  })
}

bootstrap()
