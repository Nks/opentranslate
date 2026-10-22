// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { useTranslationStore } from '@app/stores/translation'

/**
 * Tests for the swapLanguages logic on the index page.
 *
 * The swap function performs the following when source mode is 'explicit':
 *   1. Exchanges source and target language codes
 *   2. Moves translated text into source input and clears translated text
 *   3. Triggers a re-translate (not tested here — that concerns the composable)
 *
 * When source mode is 'auto', swap is a no-op (button is disabled).
 */

/** Reproduces the swap logic from app/pages/index.vue */
function swapLanguages(
  providersStore: ReturnType<typeof useProvidersStore>,
  translationStore: ReturnType<typeof useTranslationStore>,
) {
  if (providersStore.sourceSelection.mode !== 'explicit') {
    return
  }

  const currentSource = providersStore.sourceSelection.code
  const currentTarget = providersStore.targetLanguage

  if (currentTarget) {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: currentTarget,
    }
  }

  if (currentSource) {
    providersStore.targetLanguage = currentSource
  }

  if (translationStore.translatedText) {
    translationStore.sourceText = translationStore.translatedText
    translationStore.translatedText = ''
  }
}

describe('swapLanguages', () => {
  let providersStore: ReturnType<typeof useProvidersStore>
  let translationStore: ReturnType<typeof useTranslationStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    providersStore = useProvidersStore()
    translationStore = useTranslationStore()
  })

  it('exchanges source and target language codes', () => {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    providersStore.targetLanguage = 'de'

    swapLanguages(providersStore, translationStore)

    expect(providersStore.sourceSelection).toEqual({
      mode: 'explicit',
      code: 'de',
    })
    expect(providersStore.targetLanguage).toBe('en')
  })

  it('moves translated text to source input and clears translated text', () => {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    providersStore.targetLanguage = 'fr'
    translationStore.sourceText = 'Hello'
    translationStore.translatedText = 'Bonjour'

    swapLanguages(providersStore, translationStore)

    expect(translationStore.sourceText).toBe('Bonjour')
    expect(translationStore.translatedText).toBe('')
  })

  it('is a no-op when source is auto-detect', () => {
    providersStore.sourceSelection = { mode: 'auto' }
    providersStore.targetLanguage = 'de'
    translationStore.sourceText = 'Hello'
    translationStore.translatedText = 'Hallo'

    swapLanguages(providersStore, translationStore)

    expect(providersStore.sourceSelection).toEqual({ mode: 'auto' })
    expect(providersStore.targetLanguage).toBe('de')
    expect(translationStore.sourceText).toBe('Hello')
    expect(translationStore.translatedText).toBe('Hallo')
  })

  it('does not clear source text when there is no translated text', () => {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    providersStore.targetLanguage = 'ja'
    translationStore.sourceText = 'Hello'
    translationStore.translatedText = ''

    swapLanguages(providersStore, translationStore)

    expect(translationStore.sourceText).toBe('Hello')
    expect(translationStore.translatedText).toBe('')
  })

  it('handles null target language gracefully', () => {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    providersStore.targetLanguage = null
    translationStore.sourceText = 'Hello'

    swapLanguages(providersStore, translationStore)

    // source stays the same because target was null
    expect(providersStore.sourceSelection).toEqual({
      mode: 'explicit',
      code: 'en',
    })
    expect(providersStore.targetLanguage).toBe('en')
  })
})
