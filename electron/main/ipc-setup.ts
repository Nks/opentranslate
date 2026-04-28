import {
  app, dialog, ipcMain, safeStorage, BrowserWindow,
} from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  channels, type GoogleCredentialsPickResponseShape,
} from '@electron/ipc/channels'
import {
  validateGoogleCredentialsJson,
} from '@shared/providers/google-credentials'
import {
  createSettingsStore,
  type SettingsStore,
} from '@electron/services/settings/store'
import { createSecretsVault } from '@electron/services/secrets/vault'
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
import { createTranslationOrchestrator } from '@electron/services/translation/orchestrator'
import {
  createLanguageCatalog,
  type LanguageSelection,
} from '@electron/services/language-catalog/catalog'
import {
  createTranslationHandlers,
  type TranslationHandlers,
} from '@electron/services/translation/handlers'
import { createHistoryStore } from '@electron/services/history/store'
import {
  createHistoryHandlers,
  type HistoryHandlers,
} from '@electron/services/history/handlers'
import { safeHandler as rawSafeHandler } from '@electron/services/ipc/safe-handler'
import type { QuickTranslateController } from '@electron/main/quick-translate-controller'

export interface IpcSetupDeps {
  isDev: boolean
  quickTranslateController: () => QuickTranslateController | null
}

export interface IpcSetupResult {
  store: SettingsStore
}

export function registerIpcHandlers(deps: IpcSetupDeps): IpcSetupResult {
  const safeHandler = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult> => rawSafeHandler(fn, deps.isDev)

  bootstrapProviderRegistry()

  ipcMain.handle(channels['app:get-version'], safeHandler((): string => app.getVersion()))
  ipcMain.handle(channels['app:get-platform'], safeHandler((): NodeJS.Platform => process.platform))
  ipcMain.handle(channels['providers:list'], safeHandler(() => listProviderDtos()))

  const userDataDir: string = app.getPath('userData')
  const store: SettingsStore = createSettingsStore({
    userDataDir,
    providers: listProviders(),
  })
  const vault = createSecretsVault({
    userDataDir,
    safeStorage,
  })

  const settingsHandlers: SettingsAndSecretsHandlers = createSettingsAndSecretsHandlers({
    store,
    vault,
  })

  registerSettingsChannels(settingsHandlers, deps.quickTranslateController)

  const orchestrator = createTranslationOrchestrator()
  const catalog = createLanguageCatalog()
  let currentSelection: LanguageSelection = {
    source: { mode: 'auto' },
    target: null,
  }

  const translationHandlers: TranslationHandlers = createTranslationHandlers({
    orchestrator,
    catalog,
    store,
    vault,
    getDescriptor: getProvider,
    currentSelection: (): LanguageSelection => currentSelection,
  })

  ipcMain.handle(channels['provider:switch'], safeHandler(
    async (_event: unknown, input: unknown) => {
      const result = await translationHandlers['provider:switch'](input as { providerId: string })
      currentSelection = result.selection

      return result
    },
  ))
  ipcMain.handle(channels['translation:translate'], safeHandler(
    (_event: unknown, input: unknown) =>
      translationHandlers['translation:translate'](
        input as Parameters<TranslationHandlers['translation:translate']>[0],
      ),
  ))
  ipcMain.handle(channels['translation:cancel'], safeHandler(
    () => translationHandlers['translation:cancel'](),
  ))
  ipcMain.handle(channels['translation:detect'], safeHandler(
    (_event: unknown, input: unknown) =>
      translationHandlers['translation:detect'](input as { text: string }),
  ))
  ipcMain.handle(channels['language:list'], safeHandler(
    (_event: unknown, input: unknown) =>
      translationHandlers['language:list'](input as { providerId: string }),
  ))

  registerHistoryChannels(userDataDir, store)
  registerDocumentChannels(orchestrator)
  registerProviderConfigChannels()

  return { store }
}

function registerProviderConfigChannels(): void {
  const safeHandler = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult> => rawSafeHandler(fn, false)

  ipcMain.handle(channels['provider:pick-google-credentials'], safeHandler(
    async (): Promise<GoogleCredentialsPickResponseShape | null> => {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
      const result = window
        ? await dialog.showOpenDialog(window, {
            title: 'Select Google service-account JSON',
            properties: ['openFile'],
            filters: [{
              name: 'Service-account JSON',
              extensions: ['json'],
            }],
          })
        : await dialog.showOpenDialog({
            title: 'Select Google service-account JSON',
            properties: ['openFile'],
            filters: [{
              name: 'Service-account JSON',
              extensions: ['json'],
            }],
          })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      const path = result.filePaths[0]!

      let text: string

      try {
        text = await readFile(path, 'utf8')
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err)

        return {
          path,
          valid: false,
          error: `Could not read selected file: ${reason}`,
        }
      }

      const validation = validateGoogleCredentialsJson(text)

      if (!validation.valid) {
        return {
          path,
          valid: false,
          error: validation.error,
        }
      }

      return {
        path,
        valid: true,
        projectId: validation.projectId,
        clientEmail: validation.clientEmail,
      }
    },
  ))
}

function registerSettingsChannels(
  handlers: SettingsAndSecretsHandlers,
  getController: () => QuickTranslateController | null,
): void {
  const safeHandler = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult> => rawSafeHandler(fn, false)

  ipcMain.handle(channels['settings:get'], safeHandler(() => handlers['settings:get']()))
  ipcMain.handle(channels['settings:update'], safeHandler(
    async (_event: unknown, patch: unknown) => {
      const result = await handlers['settings:update'](patch as {
        app?: Record<string, unknown>
        providers?: Record<string, unknown>
      })

      getController()?.applyFromSettings(
        result.app.shortcuts.quickTranslate,
        result.app.shortcuts.quickTranslateEnabled,
      )

      return result
    },
  ))
  ipcMain.handle(channels['settings:reset'], safeHandler(async () => {
    const result = await handlers['settings:reset']()

    getController()?.applyFromSettings(
      result.app.shortcuts.quickTranslate,
      result.app.shortcuts.quickTranslateEnabled,
    )

    return result
  }))
  ipcMain.handle(channels['secrets:set'], safeHandler(
    (_event: unknown, input: unknown) =>
      handlers['secrets:set'](input as {
        providerId: string
        secret: string
      }),
  ))
  ipcMain.handle(channels['secrets:test'], safeHandler(
    (_event: unknown, input: unknown) =>
      handlers['secrets:test'](input as { providerId: string }),
  ))
}

function registerHistoryChannels(userDataDir: string, store: SettingsStore): void {
  const safeHandler = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult> => rawSafeHandler(fn, false)

  let historyHandlers: HistoryHandlers | null = null

  try {
    const historyDb = createHistoryStore(join(userDataDir, 'history.db'))
    historyHandlers = createHistoryHandlers({
      history: historyDb,
      settings: store,
    })
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[history] better-sqlite3 initialization failed', err)
  }

  ipcMain.handle(channels['history:add'], safeHandler(
    (_event: unknown, input: unknown) =>
      historyHandlers?.['history:add'](
        input as Parameters<NonNullable<typeof historyHandlers>['history:add']>[0],
      ) ?? null,
  ))
  ipcMain.handle(channels['history:list'], safeHandler(
    (_event: unknown, input: unknown) =>
      historyHandlers?.['history:list'](input as {
        limit?: number
        offset?: number
      }) ?? [],
  ))
  ipcMain.handle(channels['history:search'], safeHandler(
    (_event: unknown, input: unknown) =>
      historyHandlers?.['history:search'](input as {
        query: string
        limit?: number
      }) ?? [],
  ))
  ipcMain.handle(channels['history:delete'], safeHandler(
    (_event: unknown, input: unknown): null => {
      historyHandlers?.['history:delete'](input as { id: string })

      return null
    },
  ))
  ipcMain.handle(channels['history:clear'], safeHandler(
    () => historyHandlers?.['history:clear'](),
  ))
  ipcMain.handle(channels['history:toggle'], safeHandler(
    (_event: unknown, input: unknown) =>
      historyHandlers?.['history:toggle'](input as { enabled: boolean }),
  ))
}

function registerDocumentChannels(
  orchestrator: ReturnType<typeof createTranslationOrchestrator>,
): void {
  const safeHandler = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
  ): (...args: TArgs) => Promise<TResult> => rawSafeHandler(fn, false)

  ipcMain.handle(channels['document:status'], safeHandler(
    async (): Promise<{
      supported: boolean
      message: string
    }> => {
      const adapter = orchestrator.getAdapter()

      if (!adapter) {
        return {
          supported: false,
          message: 'No provider selected',
        }
      }

      const supported: boolean = await adapter.supportsDocumentTranslation()

      return {
        supported,
        message: supported
          ? 'Document translation available'
          : 'Document translation not supported by this provider',
      }
    },
  ))
  ipcMain.handle(channels['document:pick'], safeHandler(async () => {
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
    async (_event: unknown, _input: unknown): Promise<never> => {
      throw new Error('Document translation not yet implemented')
    },
  ))
}
