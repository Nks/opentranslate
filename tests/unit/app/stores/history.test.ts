// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useHistoryStore } from '@app/stores/history'

describe('history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes empty', () => {
    const store = useHistoryStore()

    expect(store.entries).toEqual([])
    expect(store.searchQuery).toBe('')
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('hasEntries returns false when empty', () => {
    const store = useHistoryStore()

    expect(store.hasEntries).toBe(false)
  })

  it('hasEntries returns true when entries exist', () => {
    const store = useHistoryStore()
    store.entries = [{
      id: '1',
      sourceText: 'hello',
      translatedText: 'hola',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'es',
      provider: 'google',
      createdAt: '2026-01-01T00:00:00Z',
    }]

    expect(store.hasEntries).toBe(true)
  })
})
