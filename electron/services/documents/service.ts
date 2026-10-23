import {
  basename, extname, dirname, join,
} from 'node:path'
import type {
  DocumentTranslationOutput, TranslationProvider,
} from '@shared/providers/contract'
import type { SourceLanguageSelection } from '@shared/types/translation'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import {
  inspectSourceDocument,
  loadSourceDocument,
  type LoadedSourceDocument,
  type SourceDocument,
} from '@electron/services/documents/source-file'
import {
  writeDocumentAtomically,
} from '@electron/services/documents/output-file'

export interface DocumentTranslateInput {
  filePath: string
  sourceLanguage: SourceLanguageSelection
  targetLanguage: string
}

export interface DocumentTranslateResult {
  outputPath: string
  provider: string
}

export interface DocumentStatus {
  supported: boolean
  formats: string[]
  message: string
}

export interface DocumentService {
  status: () => Promise<DocumentStatus>
  inspect: (filePath: string) => Promise<SourceDocument>
  translate: (input: DocumentTranslateInput) => Promise<DocumentTranslateResult>
}

export interface DocumentServiceDeps {
  getAdapter: () => TranslationProvider | null
}

type DocumentProvider = TranslationProvider & Required<
  Pick<TranslationProvider, 'getSupportedDocumentFormats' | 'translateDocument'>
>

interface DocumentTarget {
  provider: DocumentProvider
  formats: string[]
}

const NO_PROVIDER_STATUS: DocumentStatus = {
  supported: false,
  formats: [],
  message: 'No provider selected',
}

const UNSUPPORTED_STATUS: DocumentStatus = {
  supported: false,
  formats: [],
  message: 'Document translation not supported by this provider',
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

function asDocumentProvider(adapter: TranslationProvider): DocumentProvider | null {
  const hasDocumentMethods: boolean = typeof adapter.translateDocument === 'function' &&
    typeof adapter.getSupportedDocumentFormats === 'function'

  return hasDocumentMethods ? adapter as DocumentProvider : null
}

function unsupportedProvider(adapter: TranslationProvider): AppError {
  return new AppError(
    ErrorCategory.UnsupportedDocumentType,
    `provider "${adapter.id}" does not support document translation`,
  )
}

function toDocumentError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err
  }

  return new AppError(ErrorCategory.InternalAppError, 'document: translation failed unexpectedly', err)
}

export function createDocumentService(
  deps: DocumentServiceDeps,
): DocumentService {
  async function lookupStatus(): Promise<DocumentStatus> {
    const adapter: TranslationProvider | null = deps.getAdapter()

    if (!adapter) {
      return NO_PROVIDER_STATUS
    }

    const provider: DocumentProvider | null = asDocumentProvider(adapter)

    if (!provider) {
      return UNSUPPORTED_STATUS
    }

    const formats: string[] = await provider.getSupportedDocumentFormats()

    if (formats.length === 0) {
      return UNSUPPORTED_STATUS
    }

    return {
      supported: true,
      formats,
      message: 'Document translation available',
    }
  }

  async function status(): Promise<DocumentStatus> {
    try {
      return await lookupStatus()
    } catch (err: unknown) {
      throw toDocumentError(err)
    }
  }

  function requireDocumentProvider(): DocumentProvider {
    const adapter: TranslationProvider | null = deps.getAdapter()

    if (!adapter) {
      throw new AppError(ErrorCategory.InternalAppError, 'no active provider adapter')
    }

    const provider: DocumentProvider | null = asDocumentProvider(adapter)

    if (!provider) {
      throw unsupportedProvider(adapter)
    }

    return provider
  }

  async function resolveTarget(): Promise<DocumentTarget> {
    const provider: DocumentProvider = requireDocumentProvider()
    const formats: string[] = await provider.getSupportedDocumentFormats()

    if (formats.length === 0) {
      throw unsupportedProvider(provider)
    }

    return {
      provider,
      formats,
    }
  }

  async function inspect(filePath: string): Promise<SourceDocument> {
    try {
      const { formats }: DocumentTarget = await resolveTarget()

      return await inspectSourceDocument(filePath, formats)
    } catch (err: unknown) {
      throw toDocumentError(err)
    }
  }

  async function runTranslation(input: DocumentTranslateInput): Promise<DocumentTranslateResult> {
    const {
      provider, formats,
    }: DocumentTarget = await resolveTarget()
    const source: LoadedSourceDocument = await loadSourceDocument(input.filePath, formats)
    const translated: DocumentTranslationOutput = await provider.translateDocument({
      fileName: source.document.fileName,
      content: source.content,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    })
    const outputPath: string = buildOutputFilename(source.document.path, input.targetLanguage)

    await writeDocumentAtomically(outputPath, translated.content)

    return {
      outputPath,
      provider: translated.provider,
    }
  }

  async function translate(input: DocumentTranslateInput): Promise<DocumentTranslateResult> {
    try {
      return await runTranslation(input)
    } catch (err: unknown) {
      throw toDocumentError(err)
    }
  }

  return {
    status,
    inspect,
    translate,
  }
}
