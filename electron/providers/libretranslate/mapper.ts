import {
  normalizeLanguage,
} from '@shared/providers/normalize-language'
import {
  AppError, ErrorCategory, mapHttpStatusToCategory,
} from '@shared/errors'
import type {
  Language,
} from '@shared/types/language'
import type {
  LanguageDetectionResult,
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

const PROVIDER: ProviderId = 'libretranslate'

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

export function throwLibreHttpError(status: number, body: unknown): never {
  const category = mapHttpStatusToCategory(status)
  const detail = extractErrorDetail(body)

  throw new AppError(category, `libretranslate: http ${status} — ${detail}`)
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
