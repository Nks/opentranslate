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

const PROVIDER: ProviderId = 'google'

export interface GoogleNativeLanguage {
  language: string
  name?: string
}

export interface GoogleNativeTranslation {
  translatedText: string
  detectedSourceLanguage?: string
}

export interface GoogleNativeDetection {
  language: string
  confidence?: number
  isReliable?: boolean
}

export interface GoogleLanguagesResponse {
  data: {
    languages: readonly GoogleNativeLanguage[]
  }
}

export interface GoogleTranslateResponse {
  data: {
    translations: readonly GoogleNativeTranslation[]
  }
}

export interface GoogleDetectResponse {
  data: {
    detections: readonly (readonly GoogleNativeDetection[])[]
  }
}

export interface GoogleErrorResponse {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

export function mapGoogleLanguages(response: GoogleLanguagesResponse): Language[] {
  const list = response?.data?.languages

  if (!Array.isArray(list)) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2/languages response missing data.languages',
    )
  }

  return list.map((lang) => normalizeLanguage({
    providerCode: lang.language,
    name: lang.name ?? lang.language,
    supportsSource: true,
    supportsTarget: true,
  }))
}

export function mapGoogleTranslation(response: GoogleTranslateResponse): TranslationOutput {
  const translations = response?.data?.translations

  if (!Array.isArray(translations) || translations.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2 response missing data.translations',
    )
  }
  const first = translations[0]

  if (!first || typeof first.translatedText !== 'string') {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2 translation entry missing translatedText',
    )
  }
  const output: TranslationOutput = {
    translatedText: first.translatedText,
    provider: PROVIDER,
  }

  if (first.detectedSourceLanguage) {
    output.detectedSourceLanguage = first.detectedSourceLanguage
  }

  return output
}

export function mapGoogleDetection(response: GoogleDetectResponse): LanguageDetectionResult {
  const matrix = response?.data?.detections

  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2/detect response missing detections',
    )
  }
  const row = matrix[0]

  if (!Array.isArray(row) || row.length === 0) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2/detect row empty',
    )
  }
  const first = row[0]

  if (!first || typeof first.language !== 'string') {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      'google: /v2/detect row missing language',
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

export function throwGoogleHttpError(status: number, body: unknown): never {
  const category = mapGoogleSpecificCategory(status, body) ?? mapHttpStatusToCategory(status)
  const detail = extractGoogleErrorMessage(body) ?? `http ${status}`

  throw new AppError(category, `google: ${detail}`)
}

function mapGoogleSpecificCategory(
  status: number,
  body: unknown,
): ReturnType<typeof mapHttpStatusToCategory> | null {
  if (status !== 400) {
    return null
  }

  if (body !== null && typeof body === 'object' && 'error' in body) {
    const err = (body as GoogleErrorResponse).error

    if (err?.status === 'INVALID_ARGUMENT') {
      const message = err.message ?? ''

      if (/language|locale|not\s+supported/i.test(message)) {
        return ErrorCategory.UnsupportedLanguage
      }
    }

    if (err?.status === 'PERMISSION_DENIED' || err?.status === 'UNAUTHENTICATED') {
      return ErrorCategory.AuthenticationFailure
    }

    if (err?.status === 'RESOURCE_EXHAUSTED') {
      return ErrorCategory.QuotaExceeded
    }
  }

  return null
}

function extractGoogleErrorMessage(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || !('error' in body)) {
    return null
  }
  const err = (body as GoogleErrorResponse).error

  if (err && typeof err.message === 'string' && err.message.length > 0) {
    return err.message
  }

  return null
}
