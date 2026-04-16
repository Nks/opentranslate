import {
  describe, expect, it,
} from 'vitest'
import {
  normalizeLanguage,
} from '@shared/providers/normalize-language'

describe('normalizeLanguage', () => {
  it('returns the expected canonical shape for a simple input', () => {
    const language = normalizeLanguage({
      providerCode: 'en',
      name: 'English',
    })

    expect(language).toEqual({
      code: 'en',
      name: 'English',
      providerCode: 'en',
      supportsSource: true,
      supportsTarget: true,
    })
  })

  it('respects explicit code override', () => {
    const language = normalizeLanguage({
      providerCode: 'cmn-Hans',
      name: 'Chinese (Simplified)',
      code: 'zh-CN',
    })

    expect(language.code).toBe('zh-CN')
    expect(language.providerCode).toBe('cmn-Hans')
  })

  it('respects supportsSource / supportsTarget flags', () => {
    const language = normalizeLanguage({
      providerCode: 'eo',
      name: 'Esperanto',
      supportsSource: true,
      supportsTarget: false,
    })

    expect(language.supportsSource).toBe(true)
    expect(language.supportsTarget).toBe(false)
  })

  it('trims whitespace on provider code and name', () => {
    const language = normalizeLanguage({
      providerCode: '  en  ',
      name: '  English  ',
    })

    expect(language.providerCode).toBe('en')
    expect(language.name).toBe('English')
    expect(language.code).toBe('en')
  })

  it('rejects empty provider code', () => {
    expect(() => normalizeLanguage({
      providerCode: '   ',
      name: 'x',
    })).toThrow(/providerCode/)
  })

  it('rejects empty name', () => {
    expect(() => normalizeLanguage({
      providerCode: 'en',
      name: '  ',
    })).toThrow(/name/)
  })
})
