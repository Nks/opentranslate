// @vitest-environment happy-dom
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'

import type { TranslationOutput } from '@shared/types/translation'
import type { HistoryEntry } from '@shared/types/history'

interface TranslateRequest {
  text: string
  source: unknown
  targetLanguage: string
}

interface SettingsUpdatePayload {
  app?: {
    activeProvider?: unknown
    targetHistory?: string[]
  }
}

const mockHistoryAdd = vi.fn<(input: unknown) => Promise<HistoryEntry | null>>()
const mockTranslate = vi.fn<(input: TranslateRequest) => Promise<TranslationOutput | null>>()
const mockCancel = vi.fn<() => Promise<void>>()
const mockSettingsUpdate = vi.fn<(input: SettingsUpdatePayload) => Promise<unknown>>()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    translation: {
      translate: mockTranslate,
      cancel: mockCancel,
    },
    history: {
      add: mockHistoryAdd,
    },
    settings: {
      update: mockSettingsUpdate,
    },
  }),
}))

const { useTranslation } = await import('@app/composables/useTranslation')

describe('useTranslation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockHistoryAdd.mockResolvedValue(null)
    mockSettingsUpdate.mockResolvedValue(null)
    const settingsStore = useSettingsStore()
    settingsStore.app.debounceMs = 0
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

  describe('smart target switch on auto-detect collision', () => {
    it('switches target to the first usable history entry when auto-detect collides', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = ['ru', 'es', 'en']
      translationStore.sourceText = 'Hello world'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello world',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await vi.waitFor(() => {
        expect(providersStore.targetLanguage).toBe('ru')
      })

      const switchPersists = mockSettingsUpdate.mock.calls.filter(
        ([payload]: [SettingsUpdatePayload]): boolean => {
          return payload.app?.activeProvider !== undefined
        },
      )
      expect(switchPersists.length).toBeGreaterThanOrEqual(1)
    })

    it('reschedules the translation exactly once after the auto-switch', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = ['ru']
      translationStore.sourceText = 'Hello'

      mockTranslate
        .mockResolvedValueOnce({
          translatedText: 'Hello',
          detectedSourceLanguage: 'en',
          provider: 'libretranslate',
        })
        .mockResolvedValueOnce({
          translatedText: 'Привет',
          detectedSourceLanguage: 'en',
          provider: 'libretranslate',
        })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await vi.waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledTimes(2)
      })

      const secondCall = mockTranslate.mock.calls[1]?.[0]
      expect(secondCall?.targetLanguage).toBe('ru')
    })

    it('does not switch when targetHistory is empty', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = []
      translationStore.sourceText = 'Hello'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(providersStore.targetLanguage).toBe('en')
      expect(mockTranslate).toHaveBeenCalledTimes(1)
    })

    it('does not switch when every history entry equals the detected source', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = ['en']
      translationStore.sourceText = 'Hello'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(providersStore.targetLanguage).toBe('en')
      expect(mockTranslate).toHaveBeenCalledTimes(1)
    })

    it('never auto-switches when source is explicit, even on collision', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = {
        mode: 'explicit',
        code: 'en',
      }
      settingsStore.app.targetHistory = ['ru', 'es']
      translationStore.sourceText = 'Hello'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hello',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(providersStore.targetLanguage).toBe('en')
      expect(mockTranslate).toHaveBeenCalledTimes(1)
    })

    it('does not switch when detection does not collide with current target', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'de'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = ['ru', 'es']
      translationStore.sourceText = 'Hello'

      mockTranslate.mockResolvedValue({
        translatedText: 'Hallo',
        detectedSourceLanguage: 'en',
        provider: 'libretranslate',
      })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      expect(providersStore.targetLanguage).toBe('de')
      expect(mockTranslate).toHaveBeenCalledTimes(1)
    })
  })

  describe('pushTargetHistory', () => {
    it('prepends a fresh user-picked target to the ring buffer', () => {
      const settingsStore = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'en']

      const { pushTargetHistory } = useTranslation()
      pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual(['ru', 'es', 'en'])
      expect(mockSettingsUpdate).toHaveBeenCalledWith({
        app: { targetHistory: ['ru', 'es', 'en'] },
      })
    })

    it('deduplicates by removing prior occurrences before prepending', () => {
      const settingsStore = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'ru', 'en']

      const { pushTargetHistory } = useTranslation()
      pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual(['ru', 'es', 'en'])
    })

    it('caps the ring buffer at five entries', () => {
      const settingsStore = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'en', 'de', 'fr', 'it']

      const { pushTargetHistory } = useTranslation()
      pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual([
        'ru', 'es', 'en', 'de', 'fr',
      ])
    })

    it('ignores null or empty codes', () => {
      const settingsStore = useSettingsStore()
      settingsStore.app.targetHistory = ['es']

      const { pushTargetHistory } = useTranslation()
      pushTargetHistory(null)
      pushTargetHistory('')

      expect(settingsStore.app.targetHistory).toEqual(['es'])
      expect(mockSettingsUpdate).not.toHaveBeenCalled()
    })

    it('is NOT invoked when an auto-switch fires', async () => {
      const translationStore = useTranslationStore()
      const providersStore = useProvidersStore()
      const settingsStore = useSettingsStore()

      providersStore.activeProviderId = 'libretranslate'
      providersStore.targetLanguage = 'en'
      providersStore.sourceSelection = { mode: 'auto' }
      settingsStore.app.targetHistory = ['ru', 'es', 'en']
      translationStore.sourceText = 'Hello world'

      mockTranslate
        .mockResolvedValueOnce({
          translatedText: 'Hello world',
          detectedSourceLanguage: 'en',
          provider: 'libretranslate',
        })
        .mockResolvedValueOnce({
          translatedText: 'Привет мир',
          detectedSourceLanguage: 'en',
          provider: 'libretranslate',
        })

      const { scheduleTranslate } = useTranslation()
      await scheduleTranslate()

      await vi.waitFor(() => {
        expect(providersStore.targetLanguage).toBe('ru')
      })

      expect(settingsStore.app.targetHistory).toEqual(['ru', 'es', 'en'])
    })
  })
})
