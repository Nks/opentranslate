// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'

const mockSettingsUpdate = vi.fn<(input: unknown) => Promise<unknown>>()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    settings: { update: mockSettingsUpdate },
  }),
}))

const { useLanguagePair } = await import('@app/composables/useLanguagePair')

describe('useLanguagePair', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSettingsUpdate.mockResolvedValue(null)
  })

  it('sets an explicit source and persists the selection', () => {
    const store = useProvidersStore()
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
    const store = useProvidersStore()
    store.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }

    useLanguagePair().changeSource(null)

    expect(store.sourceSelection).toEqual({ mode: 'auto' })
  })

  it('sets the target, records it in the target history and persists', async () => {
    const store = useProvidersStore()
    const settingsStore = useSettingsStore()
    settingsStore.app.targetHistory = ['de']

    await useLanguagePair().changeTarget('ru')

    expect(store.targetLanguage).toBe('ru')
    expect(settingsStore.app.targetHistory).toEqual(['ru', 'de'])
    expect(mockSettingsUpdate).toHaveBeenCalledWith({ app: { targetHistory: ['ru', 'de'] } })
  })

  it('swaps the pair when the new target equals the explicit source', async () => {
    const store = useProvidersStore()
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
})
