import {
  normalizeLanguage,
} from '@shared/providers/normalize-language'
import {
  normalizeDocumentFormats,
} from '@shared/documents/formats'
import {
  AppError, ErrorCategory, mapHttpStatusToCategory, truncateProviderDetail, type ErrorCategoryId,
} from '@shared/errors'
import type {
  Language,
} from '@shared/types/language'
import type {
  LanguageDetectionResult,
  SourceLanguageSelection,
  TranslationOutput,
} from '@shared/types/translation'
import type {
  ProviderId,
} from '@shared/types/provider-id'

export interface LibreNativeLanguage {
  code: string
  name: string
  targets?: readonly string[]
}

export interface LibreNativeDetection {
  language: string
  confidence?: number
}

export interface LibreNativeTranslation {
  translatedText: string
  detectedLanguage?: {
    language: string
    confidence?: number
  }
}

interface LibreNativeFrontendSettings {
  filesTranslation?: unknown
  supportedFilesFormat?: unknown
}

const PROVIDER: ProviderId = 'libretranslate'
const DOCUMENT_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 403])
const DOCUMENT_REJECTION_RE: RegExp = /file format not supported|files translation are disabled/i

export function toLibreSourceCode(selection: SourceLanguageSelection): string {
  return selection.mode === 'auto' ? 'auto' : selection.code
}

export function mapLibreLanguages(native: readonly LibreNativeLanguage[]): Language[] {
  if (!Array.isArray(native)) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /languages response must be an array',
    )
  }

  return native.map((lang) => normalizeLanguage({
    providerCode: lang.code,
    name: lang.name,
    supportsSource: true,
    supportsTarget: !lang.targets || lang.targets.length > 0,
  }))
}

export function mapLibreDetection(
  native: readonly LibreNativeDetection[],
): LanguageDetectionResult {
  if (!Array.isArray(native) || native.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /detect response must be a non-empty array',
    )
  }
  const first = native[0]

  if (!first || typeof first.language !== 'string' || first.language.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /detect response missing language field',
    )
  }

  return {
    detectedLanguage: first.language,
    ...(typeof first.confidence === 'number'
      ? {
          confidence: first.confidence,
        }
      : {}),
  }
}

export function mapLibreTranslation(native: LibreNativeTranslation): TranslationOutput {
  if (
    !native ||
    typeof native.translatedText !== 'string' ||
    native.translatedText.length === 0
  ) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /translate response missing translatedText',
    )
  }
  const output: TranslationOutput = {
    translatedText: native.translatedText,
    provider: PROVIDER,
  }

  if (native.detectedLanguage?.language) {
    output.detectedSourceLanguage = native.detectedLanguage.language
  }

  return output
}

export function mapLibreFileFormats(native: unknown): string[] {
  if (native === null || typeof native !== 'object') {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /frontend/settings response must be an object',
    )
  }

  const settings: LibreNativeFrontendSettings = native as LibreNativeFrontendSettings

  if (settings.filesTranslation === false || !Array.isArray(settings.supportedFilesFormat)) {
    return []
  }

  return normalizeDocumentFormats(settings.supportedFilesFormat)
}

export function mapLibreFileTranslation(native: unknown): string {
  const url: unknown = native !== null && typeof native === 'object'
    ? (native as { translatedFileUrl?: unknown }).translatedFileUrl
    : undefined

  if (typeof url !== 'string' || url.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'libretranslate: /translate_file response missing translatedFileUrl',
    )
  }

  return url
}

export function throwLibreHttpError(status: number, body: unknown): never {
  const detail: string = extractErrorDetail(body)

  throw new AppError(
    resolveLibreCategory(status, detail),
    `libretranslate: http ${status} — ${truncateProviderDetail(detail)}`,
  )
}

function resolveLibreCategory(status: number, detail: string): ErrorCategoryId {
  const isDocumentRejection: boolean = DOCUMENT_REJECTION_STATUSES.has(status) &&
    DOCUMENT_REJECTION_RE.test(detail)

  return isDocumentRejection
    ? ErrorCategory.UnsupportedDocumentType
    : mapHttpStatusToCategory(status)
}

function extractErrorDetail(body: unknown): string {
  if (typeof body === 'string' && body.length > 0) {
    return body
  }

  if (body !== null && typeof body === 'object' && 'error' in body) {
    const error = (body as {
      error: unknown
    }).error

    if (typeof error === 'string' && error.length > 0) {
      return error
    }
  }

  return 'unknown'
}
