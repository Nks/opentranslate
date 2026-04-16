import {
  describe, expect, it,
} from 'vitest'
import {
  mapLibreLanguages,
  mapLibreDetection,
  mapLibreTranslation,
  throwLibreHttpError,
} from '@electron/providers/libretranslate/mapper'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

describe('mapLibreLanguages', () => {
  it('normalizes a list of libre languages', () => {
    const result = mapLibreLanguages([
      {
        code: 'en',
        name: 'English',
        targets: ['de', 'fr'],
      },
      {
        code: 'de',
        name: 'German',
        targets: ['en'],
      },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]?.code).toBe('en')
    expect(result[0]?.providerCode).toBe('en')
    expect(result[0]?.supportsSource).toBe(true)
    expect(result[0]?.supportsTarget).toBe(true)
  })

  it('marks target=false when targets array is empty', () => {
    const result = mapLibreLanguages([
      {
        code: 'xx',
        name: 'Test',
        targets: [],
      },
    ])

    expect(result[0]?.supportsTarget).toBe(false)
  })

  it('throws InvalidProviderResponse on non-array input', () => {
    expect(() => mapLibreLanguages('not-an-array' as unknown as [])).toThrow(AppError)
  })
})

describe('mapLibreDetection', () => {
  it('picks the first detection result', () => {
    const result = mapLibreDetection([
      {
        language: 'en',
        confidence: 0.9,
      },
      {
        language: 'de',
        confidence: 0.1,
      },
    ])

    expect(result.detectedLanguage).toBe('en')
    expect(result.confidence).toBe(0.9)
  })

  it('works without confidence', () => {
    const result = mapLibreDetection([
      {
        language: 'en',
      },
    ])

    expect(result.detectedLanguage).toBe('en')
    expect(result.confidence).toBeUndefined()
  })

  it('throws on empty array', () => {
    expect(() => mapLibreDetection([])).toThrow(AppError)
  })

  it('throws on missing language field', () => {
    expect(() => mapLibreDetection([
      {
        language: '',
      },
    ])).toThrow(AppError)
  })
})

describe('mapLibreTranslation', () => {
  it('maps translated text with detectedSourceLanguage', () => {
    const out = mapLibreTranslation({
      translatedText: 'hola',
      detectedLanguage: {
        language: 'en',
      },
    })

    expect(out.translatedText).toBe('hola')
    expect(out.detectedSourceLanguage).toBe('en')
    expect(out.provider).toBe('libretranslate')
  })

  it('maps without detection', () => {
    const out = mapLibreTranslation({
      translatedText: 'hola',
    })

    expect(out.detectedSourceLanguage).toBeUndefined()
  })

  it('throws when translatedText is missing', () => {
    expect(() => mapLibreTranslation({
      translatedText: '',
    })).toThrow(AppError)
  })
})

describe('throwLibreHttpError', () => {
  it('maps 401 to AuthenticationFailure', () => {
    try {
      throwLibreHttpError(401, {
        error: 'Invalid API key',
      })
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
      expect((err as AppError).message).toContain('Invalid API key')
    }
  })

  it('maps 429 to RateLimited', () => {
    try {
      throwLibreHttpError(429, null)
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.RateLimited)
    }
  })

  it('maps 500 to EndpointUnreachable', () => {
    try {
      throwLibreHttpError(503, 'service down')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.EndpointUnreachable)
    }
  })
})
