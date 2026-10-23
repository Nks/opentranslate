import {
  dialog, ipcMain, shell,
} from 'electron'
import { channels } from '@electron/ipc/channels'
import { safeHandler } from '@electron/services/ipc/safe-handler'
import { createDocumentService } from '@electron/services/documents/service'
import {
  createDocumentHandlers,
  type DocumentHandlers,
  type DocumentOpenDialogOptions,
} from '@electron/services/documents/handlers'
import type { TranslationProvider } from '@shared/providers/contract'

export function registerDocumentChannels(
  getAdapter: () => TranslationProvider | null,
): void {
  const handlers: DocumentHandlers = createDocumentHandlers({
    service: createDocumentService({ getAdapter }),
    showOpenDialog: (options: DocumentOpenDialogOptions) => dialog.showOpenDialog(options),
    showItemInFolder: (fullPath: string): void => shell.showItemInFolder(fullPath),
    getAdapter,
  })

  ipcMain.handle(channels['document:status'], safeHandler(() => handlers['document:status']()))
  ipcMain.handle(channels['document:pick'], safeHandler(() => handlers['document:pick']()))
  ipcMain.handle(channels['document:drop'], safeHandler(
    (_event: unknown, input: unknown) => handlers['document:drop'](input),
  ))
  ipcMain.handle(channels['document:translate'], safeHandler(
    (_event: unknown, input: unknown) => handlers['document:translate'](input),
  ))
  ipcMain.handle(channels['document:reveal'], safeHandler(() => handlers['document:reveal']()))
}
