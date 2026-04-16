import {
  describe, expect, it,
} from 'vitest'
import {
  mapGoogleLanguages,
  mapGoogleTranslation,
  mapGoogleDetection,
  throwGoogleHttpError,
} from '@electron/providers/google/mapper'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

describe('mapGoogleLanguages', () => {
  it('normalizes a v2 languages response', () => {
    const result = mapGoogleLanguages({
      data: {
        languages: [
          {
            language: 'en',
            name: 'English',
          },
          {
            language: 'de',
            name: 'German',
          },
        ],
      },
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.code).toBe('en')
    expect(result[0]?.providerCode).toBe('en')
  })

  it('falls back to code as name when name is missing', () => {
    const result = mapGoogleLanguages({
      data: {
        languages: [
          {
            language: 'xx',
          },
        ],
      },
    })

    expect(result[0]?.name).toBe('xx')
  })

  it('throws on missing data.languages', () => {
    expect(() => mapGoogleLanguages({
      data: {},
    } as unknown as Parameters<typeof mapGoogleLanguages>[0])).toThrow(AppError)
  })
})

describe('mapGoogleTranslation', () => {
  it('maps a single translation entry', () => {
    const result = mapGoogleTranslation({
      data: {
        translations: [
          {
            translatedText: 'hallo',
            detectedSourceLanguage: 'en',
          },
        ],
      },
    })

    expect(result.translatedText).toBe('hallo')
    expect(result.detectedSourceLanguage).toBe('en')
    expect(result.provider).toBe('google')
  })

  it('throws on empty translations array', () => {
    expect(() => mapGoogleTranslation({
      data: {
        translations: [],
      },
    })).toThrow(AppError)
  })
})

describe('mapGoogleDetection', () => {
  it('picks the first row first entry', () => {
    const result = mapGoogleDetection({
      data: {
        detections: [
          [
            {
              language: 'en',
              confidence: 0.95,
            },
            {
              language: 'de',
              confidence: 0.05,
            },
          ],
        ],
      },
    })

    expect(result.detectedLanguage).toBe('en')
    expect(result.confidence).toBe(0.95)
  })

  it('throws on empty detections', () => {
    expect(() => mapGoogleDetection({
      data: {
        detections: [],
      },
    })).toThrow(AppError)
  })
})

describe('throwGoogleHttpError', () => {
  it('maps INVALID_ARGUMENT with language message to unsupported_language', () => {
    try {
      throwGoogleHttpError(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'Source language is not supported',
        },
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.UnsupportedLanguage)
    }
  })

  it('maps PERMISSION_DENIED to authentication_failure', () => {
    try {
      throwGoogleHttpError(400, {
        error: {
          status: 'PERMISSION_DENIED',
          message: 'no',
        },
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })

  it('maps RESOURCE_EXHAUSTED to quota_exceeded', () => {
    try {
      throwGoogleHttpError(400, {
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'quota reached',
        },
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.QuotaExceeded)
    }
  })

  it('falls back to http mapper for non-google shapes', () => {
    try {
      throwGoogleHttpError(503, null)
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.EndpointUnreachable)
    }
  })

  it('maps 400 INVALID_ARGUMENT without language keyword to InvalidProviderResponse', () => {
    try {
      throwGoogleHttpError(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'Request contains an invalid value',
        },
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.InvalidProviderResponse)
    }
  })

  it('maps 400 with no error body to InvalidProviderResponse', () => {
    try {
      throwGoogleHttpError(400, null)
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.InvalidProviderResponse)
    }
  })

  it('maps 400 with empty error object to InvalidProviderResponse', () => {
    try {
      throwGoogleHttpError(400, {
        error: {},
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.InvalidProviderResponse)
      expect((err as AppError).message).toContain('http 400')
    }
  })

  it('maps 401 to AuthenticationFailure', () => {
    try {
      throwGoogleHttpError(401, {
        error: {
          status: 'UNAUTHENTICATED',
          message: 'bad token',
        },
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })

  it('maps 429 to RateLimited', () => {
    try {
      throwGoogleHttpError(429, null)
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.RateLimited)
    }
  })
})
