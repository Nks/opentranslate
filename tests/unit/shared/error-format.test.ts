import {
  describe, expect, it,
} from 'vitest'
import {
  formatErrorCategory,
  formatErrorMessage,
  stripIpcWrapper,
  extractProviderHint,
  isKnownCategory,
} from '@shared/errors/format'
import { ErrorCategory } from '@shared/types/errors'

describe('formatErrorMessage', () => {
  it('strips the Electron IPC wrapper from the detail', () => {
    const err = new Error(
      "Error invoking remote method 'translation:translate': Error: [invalid_provider_response] AppError: libretranslate: http 400",
    )
    const formatted = formatErrorMessage(err)

    expect(formatted.detail).toBe(
      '[invalid_provider_response] AppError: libretranslate: http 400',
    )
    expect(formatted.detail).not.toContain('Error invoking remote method')
  })

  it('detects the category from a [<id>] prefix', () => {
    const err = new Error(
      'Error invoking remote method "translation:translate": Error: [authentication_failure] AppError: provider rejected key',
    )
    const formatted = formatErrorMessage(err)

    expect(formatted.category).toBe(ErrorCategory.AuthenticationFailure)
    expect(formatted.short).toMatch(/credentials/i)
  })

  it('appends the provider hint to the friendly sentence', () => {
    const err = new Error(
      "Error invoking remote method 'translation:translate': Error: [invalid_provider_response] AppError: libretranslate: http 400 — Visit https://portal.libretranslate.com to get an API key",
    )
    const formatted = formatErrorMessage(err)

    expect(formatted.short).toContain('Visit https://portal.libretranslate.com')
    expect(formatted.short).toMatch(/unexpected response/i)
  })

  it('strips the preload [channel] prefix in front of the IPC wrapper', () => {
    const err = new Error(
      "[document:translate] Error invoking remote method 'document:translate': Error: [unsupported_document_type] AppError: document: unsupported file type \".pdf\" — Supported formats: .txt, .docx",
    )
    const formatted = formatErrorMessage(err)

    expect(formatted.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(formatted.detail).toBe(
      '[unsupported_document_type] AppError: document: unsupported file type ".pdf" — Supported formats: .txt, .docx',
    )
    expect(formatted.short).toContain('Supported formats: .txt, .docx')
  })

  it('falls back to the internal_app_error friendly copy when category is unknown', () => {
    const err = new Error('boom')
    const formatted = formatErrorMessage(err)

    expect(formatted.category).toBe('unknown')
    expect(formatted.short).toMatch(/Something went wrong/i)
    expect(formatted.detail).toBe('boom')
  })

  it('handles non-Error values by stringifying them', () => {
    const formatted = formatErrorMessage('plain string error')

    expect(formatted.detail).toBe('plain string error')
    expect(formatted.short).toMatch(/Something went wrong/i)
  })

  it('maps every defined ErrorCategory to a non-empty friendly sentence', () => {
    for (const value of Object.values(ErrorCategory)) {
      const err = new Error(`[${value}] AppError: synthetic`)
      const formatted = formatErrorMessage(err)
      expect(formatted.category).toBe(value)
      expect(formatted.short.length).toBeGreaterThan(10)
    }
  })
})

describe('stripIpcWrapper', () => {
  it('removes the wrapper when present', () => {
    const cleaned = stripIpcWrapper(
      "Error invoking remote method 'foo:bar': Error: payload",
    )
    expect(cleaned).toBe('payload')
  })

  it('leaves the message unchanged when no wrapper is present', () => {
    expect(stripIpcWrapper('plain message')).toBe('plain message')
  })
})

describe('extractProviderHint', () => {
  it('returns the trailing hint after an em-dash', () => {
    expect(extractProviderHint('http 400 — Visit example.com')).toBe('Visit example.com')
  })

  it('returns null when no hint is present', () => {
    expect(extractProviderHint('http 400')).toBeNull()
  })
})

describe('isKnownCategory', () => {
  it('accepts every value defined on ErrorCategory', () => {
    for (const value of Object.values(ErrorCategory)) {
      expect(isKnownCategory(value)).toBe(true)
    }
  })

  it('rejects unknown ids', () => {
    expect(isKnownCategory('not_a_category')).toBe(false)
    expect(isKnownCategory('')).toBe(false)
  })
})

describe('formatErrorCategory', () => {
  it('labels every defined ErrorCategory', () => {
    for (const value of Object.values(ErrorCategory)) {
      expect(formatErrorCategory(value).length).toBeGreaterThan(3)
    }
  })

  it('labels the document type category', () => {
    expect(formatErrorCategory(ErrorCategory.UnsupportedDocumentType)).toBe('Unsupported document type')
  })

  it('labels an unknown category', () => {
    expect(formatErrorCategory('unknown')).toBe('Unknown error')
  })
})
