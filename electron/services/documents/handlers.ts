import type {
  ZodSafeParseResult,
} from 'zod'
import {
  documentDropRequestSchema,
  documentTranslateRequestSchema,
  type DocumentDropRequest,
  type DocumentTranslateRequest,
} from '@shared/schemas/document-request'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import type { TranslationProvider } from '@shared/providers/contract'
import type {
  DocumentService, DocumentStatus, DocumentTranslateResult,
} from '@electron/services/documents/service'
import type { SourceDocument } from '@electron/services/documents/source-file'

export interface DocumentDialogFilter {
  name: string
  extensions: string[]
}

export interface DocumentOpenDialogOptions {
  properties: ['openFile']
  filters: DocumentDialogFilter[]
}

export interface DocumentOpenDialogResult {
  canceled: boolean
  filePaths: string[]
}

export type DocumentOpenDialog = (
  options: DocumentOpenDialogOptions,
) => Promise<DocumentOpenDialogResult>

export interface DocumentSelection {
  filePath: string
  fileName: string
  extension: string
}

interface AllowlistedSelection {
  filePath: string
  adapter: TranslationProvider | null
}

export interface DocumentHandlers {
  'document:status': () => Promise<DocumentStatus>
  'document:pick': () => Promise<DocumentSelection | null>
  'document:drop': (input: unknown) => Promise<DocumentSelection>
  'document:translate': (input: unknown) => Promise<DocumentTranslateResult>
  'document:reveal': () => Promise<void>
}

export interface DocumentHandlerDeps {
  service: DocumentService
  showOpenDialog: DocumentOpenDialog
  showItemInFolder: (fullPath: string) => void
  getAdapter: () => TranslationProvider | null
}

const ALL_FILES_FILTER: DocumentDialogFilter = {
  name: 'All Files',
  extensions: ['*'],
}

function buildPickFilters(formats: readonly string[]): DocumentDialogFilter[] {
  if (formats.length === 0) {
    return [ALL_FILES_FILTER]
  }

  return [
    {
      name: 'Supported documents',
      extensions: formats.map((format: string): string => format.slice(1)),
    },
    ALL_FILES_FILTER,
  ]
}

function invalidPayload(channel: string): AppError {
  return new AppError(ErrorCategory.InternalAppError, `${channel}: invalid request payload`)
}

export function createDocumentHandlers(deps: DocumentHandlerDeps): DocumentHandlers {
  let selection: AllowlistedSelection | null = null
  let lastOutputPath: string | null = null

  function providerChanged(channel: string, moment: string): AppError {
    return new AppError(
      ErrorCategory.InternalAppError,
      `${channel}: the provider changed ${moment} — Select the file again.`,
    )
  }

  async function select(filePath: string): Promise<DocumentSelection> {
    const adapter: TranslationProvider | null = deps.getAdapter()
    const document: SourceDocument = await deps.service.inspect(filePath)

    if (deps.getAdapter() !== adapter) {
      throw providerChanged('document:select', 'while the file was being checked')
    }

    selection = {
      filePath,
      adapter,
    }

    return {
      filePath,
      fileName: document.fileName,
      extension: document.extension,
    }
  }

  function assertSelected(filePath: string): void {
    if (selection?.filePath !== filePath) {
      throw new AppError(
        ErrorCategory.InternalAppError,
        'document:translate: file was not selected through the document picker',
      )
    }

    if (selection.adapter !== deps.getAdapter()) {
      throw providerChanged('document:translate', 'since the file was selected')
    }
  }

  return {
    'document:status': () => deps.service.status(),
    'document:pick': async () => {
      const { formats }: DocumentStatus = await deps.service.status()
      const result: DocumentOpenDialogResult = await deps.showOpenDialog({
        properties: ['openFile'],
        filters: buildPickFilters(formats),
      })
      const filePath: string | undefined = result.filePaths[0]

      if (result.canceled || filePath === undefined) {
        return null
      }

      return select(filePath)
    },
    'document:drop': async (input: unknown) => {
      const parsed: ZodSafeParseResult<DocumentDropRequest> =
        documentDropRequestSchema.safeParse(input)

      if (!parsed.success) {
        throw invalidPayload('document:drop')
      }

      return select(parsed.data.filePath)
    },
    'document:translate': async (input: unknown) => {
      const parsed: ZodSafeParseResult<DocumentTranslateRequest> =
        documentTranslateRequestSchema.safeParse(input)

      if (!parsed.success) {
        throw invalidPayload('document:translate')
      }

      assertSelected(parsed.data.filePath)

      const result: DocumentTranslateResult = await deps.service.translate(parsed.data)
      lastOutputPath = result.outputPath

      return result
    },
    'document:reveal': async () => {
      if (lastOutputPath === null) {
        throw new AppError(
          ErrorCategory.InternalAppError,
          'document:reveal: no translated file to show yet',
        )
      }

      deps.showItemInFolder(lastOutputPath)
    },
  }
}
