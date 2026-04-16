// @vitest-environment happy-dom
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'

import type { TranslationOutput } from '@shared/types/translation'
import type { HistoryEntry } from '@shared/types/history'

const mockHistoryAdd = vi.fn<() => Promise<HistoryEntry | null>>()
const mockTranslate = vi.fn<() => Promise<TranslationOutput | null>>()
const mockCancel = vi.fn<() => Promise<void>>()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    translation: {
      translate: mockTranslate,
      cancel: mockCancel,
    },
    history: {
      add: mockHistoryAdd,
    },
  }),
}))

// Must import after vi.mock so the mock is in place
const { useTranslation } = await import('@app/composables/useTranslation')

describe('useTranslation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockHistoryAdd.mockResolvedValue(null)
  })

  describe('history recording', () => {
    it('calls history.add after a successful translation', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'de'
      providersStore.sourceSelection = { mode: 'auto' }
      translationStore.sourceText = 'Hello world'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hallo Welt',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      // Allow fire-and-forget microtask to settle
      await vi.waitFor(() => {
        expect(mockHistoryAdd).toHaveBeenCalledOnce()
      })

      expect(mockHistoryAdd).toHaveBeenCalledWith({
        sourceText: 'Hello world',
        translatedText: 'Hallo Welt',
        sourceLanguageCode: 'en',
        targetLanguageCode: 'de',
        provider: 'libretranslate',
      })
    })

    it('uses explicit source language code when detection is absent', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'google'
      providersStore.targetLanguage = 'fr'
      providersStore.sourceSelection = {
        mode: 'explicit',
        code: 'es',
      }
      translationStore.sourceText = 'Hola'

      mockTranslate.mockResolvedValue({
        translatedText: 'Bonjour',
        provider: 'google',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await vi.waitFor(() => {
        expect(mockHistoryAdd).toHaveBeenCalledOnce()
      })

      expect(mockHistoryAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLanguageCode: 'es',
        }),
      )
    })

    it('falls back to "auto" when source is auto-detect and no detection returned', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      translationStore.sourceText = 'Bonjour'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await vi.waitFor(() => {
        expect(mockHistoryAdd).toHaveBeenCalledOnce()
      })

      expect(mockHistoryAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLanguageCode: 'auto',
        }),
      )
    })

    it('does not call history.add when translation returns null', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      translationStore.sourceText = 'Hello'

      mockTranslate.mockResolvedValue(null)

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      // Give microtasks a chance to settle
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(mockHistoryAdd).not.toHaveBeenCalled()
    })

    it('does not call history.add when translation throws', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      translationStore.sourceText = 'Hello'

      mockTranslate.mockRejectedValue(new Error('network error'))

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(mockHistoryAdd).not.toHaveBeenCalled()
    })

    it('does not break translation when history.add rejects', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      translationStore.sourceText = 'Bonjour'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello',
        detectedSourceLanguage: 'fr',
        provider: 'libretranslate',
      })
      mockHistoryAdd.mockRejectedValue(new Error('storage full'))

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      // Give the rejected fire-and-forget time to settle
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      // Translation result is still set despite history failure
      expect(translationStore.translatedText).toBe('Hello')
      expect(translationStore.error).toBeNull()
    })

    it('does not call history.add when source text is empty', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()

      providersStore.activeProviderId = 'libretranslate'
      translationStore.sourceText = '   '

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      expect(mockTranslate).not.toHaveBeenCalled()
      expect(mockHistoryAdd).not.toHaveBeenCalled()
    })
  })
})
