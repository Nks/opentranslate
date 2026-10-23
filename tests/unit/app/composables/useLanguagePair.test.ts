// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi, type Mock,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import type * as UseLanguagePairModule from '@app/composables/useLanguagePair'

const mockSettingsUpdate: Mock<(input: unknown) => Promise<unknown>> = vi.fn<
  (input: unknown) => Promise<unknown>
>()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    settings: { update: mockSettingsUpdate },
  }),
}))

const { useLanguagePair }: typeof UseLanguagePairModule = await import('@app/composables/useLanguagePair')

describe('useLanguagePair', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSettingsUpdate.mockResolvedValue(null)
  })

  it('sets an explicit source and persists the selection', () => {
    const store: ReturnType<typeof useProvidersStore> = useProvidersStore()
    store.activeProviderId = 'libretranslate'
    store.targetLanguage = 'ru'

    useLanguagePair().changeSource('en')

    expect(store.sourceSelection).toEqual({
      mode: 'explicit',
      code: 'en',
    })
    expect(mockSettingsUpdate).toHaveBeenCalledWith({
      app: {
        activeProvider: {
          providerId: 'libretranslate',
          sourceSelection: {
            mode: 'explicit',
            code: 'en',
          },
          targetLanguage: 'ru',
        },
      },
    })
  })

  it('returns to auto-detect when the source is cleared', () => {
    const store: ReturnType<typeof useProvidersStore> = useProvidersStore()
    store.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }

    useLanguagePair().changeSource(null)

    expect(store.sourceSelection).toEqual({ mode: 'auto' })
  })

  it('sets the target, records it in the target history and persists', async () => {
    const store: ReturnType<typeof useProvidersStore> = useProvidersStore()
    const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
    settingsStore.app.targetHistory = ['de']

    await useLanguagePair().changeTarget('ru')

    expect(store.targetLanguage).toBe('ru')
    expect(settingsStore.app.targetHistory).toEqual(['ru', 'de'])
    expect(mockSettingsUpdate).toHaveBeenCalledWith({ app: { targetHistory: ['ru', 'de'] } })
  })

  it('swaps the pair when the new target equals the explicit source', async () => {
    const store: ReturnType<typeof useProvidersStore> = useProvidersStore()
    store.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    store.targetLanguage = 'ru'

    await useLanguagePair().changeTarget('en')

    expect(store.targetLanguage).toBe('en')
    expect(store.sourceSelection).toEqual({
      mode: 'explicit',
      code: 'ru',
    })
  })

  describe('pushTargetHistory', () => {
    it('prepends a fresh user-picked target to the ring buffer', async () => {
      const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'en']

      const { pushTargetHistory }: ReturnType<typeof useLanguagePair> = useLanguagePair()
      await pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual(['ru', 'es', 'en'])
      expect(mockSettingsUpdate).toHaveBeenCalledWith({
        app: { targetHistory: ['ru', 'es', 'en'] },
      })
    })

    it('deduplicates by removing prior occurrences before prepending', async () => {
      const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'ru', 'en']

      const { pushTargetHistory }: ReturnType<typeof useLanguagePair> = useLanguagePair()
      await pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual(['ru', 'es', 'en'])
    })

    it('caps the ring buffer at five entries', async () => {
      const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
      settingsStore.app.targetHistory = ['es', 'en', 'de', 'fr', 'it']

      const { pushTargetHistory }: ReturnType<typeof useLanguagePair> = useLanguagePair()
      await pushTargetHistory('ru')

      expect(settingsStore.app.targetHistory).toEqual([
        'ru', 'es', 'en', 'de', 'fr',
      ])
    })

    it('ignores null or empty codes', async () => {
      const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
      settingsStore.app.targetHistory = ['es']

      const { pushTargetHistory }: ReturnType<typeof useLanguagePair> = useLanguagePair()
      await pushTargetHistory(null)
      await pushTargetHistory('')

      expect(settingsStore.app.targetHistory).toEqual(['es'])
      expect(mockSettingsUpdate).not.toHaveBeenCalled()
    })
  })
})
