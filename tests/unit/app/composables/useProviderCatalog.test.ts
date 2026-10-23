// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'

const LIBRE_DESCRIPTOR: ProviderDescriptorDto = {
  id: 'libretranslate',
  displayName: 'LibreTranslate',
  description: '',
  settingsFields: [],
  secretFields: [],
}

const mockList = vi.fn<() => Promise<ProviderDescriptorDto[]>>()
const mockSettingsGet = vi.fn<() => Promise<{ providers: Record<string, unknown> }>>()
const mockToastAdd = vi.fn<(options: Record<string, unknown>) => void>()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    providers: { list: mockList },
    settings: { get: mockSettingsGet },
  }),
}))

const { useProviderCatalog } = await import('@app/composables/useProviderCatalog')

describe('useProviderCatalog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(globalThis as Record<string, unknown>).useToast = () => ({ add: mockToastAdd })
  })

  it('loads descriptors and per-provider settings into the store', async () => {
    mockList.mockResolvedValue([LIBRE_DESCRIPTOR])
    mockSettingsGet.mockResolvedValue({
      providers: {
        libretranslate: { enabled: true },
        google: null,
      },
    })

    await useProviderCatalog().loadProviderCatalog()

    const store = useProvidersStore()
    expect(store.descriptors).toEqual([LIBRE_DESCRIPTOR])
    expect(store.providerSettings).toEqual({
      libretranslate: { enabled: true },
      google: {},
    })
    expect(store.activeDescriptors).toEqual([LIBRE_DESCRIPTOR])
  })

  it('surfaces a load failure through the toast handler', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    mockSettingsGet.mockResolvedValue({ providers: {} })

    await useProviderCatalog().loadProviderCatalog()

    expect(mockToastAdd).toHaveBeenCalledOnce()
  })
})
