import {
  basename, extname, dirname, join,
} from 'node:path'
import type {
  TranslationProvider, DocumentTranslationInput,
} from '@shared/providers/contract'
import type { SourceLanguageSelection } from '@shared/types/translation'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

export interface DocumentTranslateInput {
  filePath: string
  sourceLanguage: SourceLanguageSelection
  targetLanguage: string
}

export interface DocumentTranslateResult {
  outputPath: string
  provider: string
}

export interface DocumentService {
  translate: (input: DocumentTranslateInput) => Promise<DocumentTranslateResult>
  buildOutputPath: (filePath: string, targetLanguage: string) => string
  isSupported: () => Promise<boolean>
}

export interface DocumentServiceDeps {
  getAdapter: () => TranslationProvider | null
}

export function buildOutputFilename(
  filePath: string,
  targetLanguage: string,
): string {
  const dir = dirname(filePath)
  const ext = extname(filePath)
  const name = basename(filePath, ext)

  return join(dir, `${name}.${targetLanguage}.translated${ext}`)
}

export function createDocumentService(
  deps: DocumentServiceDeps,
): DocumentService {
  async function translate(
    input: DocumentTranslateInput,
  ): Promise<DocumentTranslateResult> {
    const adapter = deps.getAdapter()

    if (!adapter) {
      throw new AppError(
        ErrorCategory.InternalAppError,
        'no active provider adapter',
      )
    }

    const supportsDoc = await adapter.supportsDocumentTranslation()

    if (!supportsDoc) {
      throw new AppError(
        ErrorCategory.UnsupportedDocumentType,
        `provider "${adapter.id}" does not support document translation`,
      )
    }

    if (!adapter.translateDocument) {
      throw new AppError(
        ErrorCategory.UnsupportedDocumentType,
        `provider "${adapter.id}" has no translateDocument implementation`,
      )
    }

    const docInput: DocumentTranslationInput = {
      sourcePath: input.filePath,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    }

    const result = await adapter.translateDocument(docInput)

    return {
      outputPath: result.outputPath,
      provider: result.provider,
    }
  }

  async function isSupported(): Promise<boolean> {
    const adapter = deps.getAdapter()

    if (!adapter) {
      return false
    }

    return adapter.supportsDocumentTranslation()
  }

  return {
    translate,
    buildOutputPath: buildOutputFilename,
    isSupported,
  }
}
