// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useTranslationStore } from '@app/stores/translation'

describe('translation store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty source and output', () => {
    const store = useTranslationStore()

    expect(store.sourceText).toBe('')
    expect(store.translatedText).toBe('')
    expect(store.detectedSourceLanguage).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('updates source text reactively', () => {
    const store = useTranslationStore()
    store.sourceText = 'hello world'

    expect(store.sourceText).toBe('hello world')
  })

  it('tracks loading and error state', () => {
    const store = useTranslationStore()
    store.loading = true
    store.error = 'network failed'

    expect(store.loading).toBe(true)
    expect(store.error).toBe('network failed')
  })
})
