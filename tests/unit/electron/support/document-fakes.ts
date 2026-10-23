import { vi } from 'vitest'
import {
  createDocumentHandlers,
  type DocumentHandlers,
  type DocumentOpenDialog,
  type DocumentOpenDialogOptions,
} from '@electron/services/documents/handlers'
import type {
  DocumentService, DocumentStatus, DocumentTranslateResult,
} from '@electron/services/documents/service'
import type {
  DocumentTranslateRequest,
} from '@shared/schemas/document-request'

export const SUPPORTED_STATUS: DocumentStatus = {
  supported: true,
  formats: ['.txt', '.pdf'],
  message: 'Document translation available',
}

export const PICKED_REQUEST: DocumentTranslateRequest = {
  filePath: '/docs/report.txt',
  sourceLanguage: { mode: 'auto' },
  targetLanguage: 'ru',
}

export const TRANSLATED_OUTPUT_PATH = '/docs/report.ru.translated.txt'

export function fakeService(status: DocumentStatus = SUPPORTED_STATUS): DocumentService {
  return {
    status: vi.fn(async (): Promise<DocumentStatus> => status),
    inspect: vi.fn(async (): Promise<void> => undefined),
    translate: vi.fn(async (): Promise<DocumentTranslateResult> => ({
      outputPath: TRANSLATED_OUTPUT_PATH,
      provider: 'libretranslate',
    })),
  }
}

export function fakeDialog(filePaths: string[], canceled: boolean = false): DocumentOpenDialog {
  return vi.fn(async (_options: DocumentOpenDialogOptions) => ({
    canceled,
    filePaths,
  }))
}

export interface HandlerFixture {
  handlers: DocumentHandlers
  service: DocumentService
  showOpenDialog: DocumentOpenDialog
  showItemInFolder: (fullPath: string) => void
}

export function buildHandlers(overrides: Partial<Omit<HandlerFixture, 'handlers'>> = {}): HandlerFixture {
  const service: DocumentService = overrides.service ?? fakeService()
  const showOpenDialog: DocumentOpenDialog = overrides.showOpenDialog ?? fakeDialog([])
  const showItemInFolder: (fullPath: string) => void = overrides.showItemInFolder ??
    vi.fn<(fullPath: string) => void>()

  return {
    handlers: createDocumentHandlers({
      service,
      showOpenDialog,
      showItemInFolder,
    }),
    service,
    showOpenDialog,
    showItemInFolder,
  }
}
