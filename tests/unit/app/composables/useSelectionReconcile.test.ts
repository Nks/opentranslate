import {
  describe, expect, it,
} from 'vitest'
import {
  pickFallbackTarget,
} from '@app/composables/useSelectionReconcile'

describe('pickFallbackTarget', () => {
  it('returns null when history is empty', () => {
    const result: string | null = pickFallbackTarget([], 'en', 'en')
    expect(result).toBeNull()
  })

  it('returns null when every history entry collides with detected source', () => {
    const result: string | null = pickFallbackTarget(['en', 'en', 'en'], 'en', 'en')
    expect(result).toBeNull()
  })

  it('returns null when every history entry equals the current target', () => {
    const result: string | null = pickFallbackTarget(['en'], 'fr', 'en')
    expect(result).toBeNull()
  })

  it('returns the first history entry that differs from detected source and current target', () => {
    const result: string | null = pickFallbackTarget(['en', 'ru', 'es'], 'en', 'en')
    expect(result).toBe('ru')
  })

  it('skips the current target even when it differs from detected source', () => {
    const result: string | null = pickFallbackTarget(['fr', 'ru', 'es'], 'en', 'fr')
    expect(result).toBe('ru')
  })

  it('honors MRU order — first usable entry wins', () => {
    const result: string | null = pickFallbackTarget(['ru', 'es', 'de'], 'en', 'en')
    expect(result).toBe('ru')
  })

  it('returns null when history holds only detected source and current target', () => {
    const result: string | null = pickFallbackTarget(['en', 'fr'], 'en', 'fr')
    expect(result).toBeNull()
  })
})
