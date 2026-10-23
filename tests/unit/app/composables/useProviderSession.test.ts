// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi, type Mock,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type * as UseProviderSessionModule from '@app/composables/useProviderSession'

interface SettingsPayload {
  app: {
    activeProvider: {
      providerId: string | null
      sourceSelection: { mode: 'auto' }
      targetLanguage: string | null
    }
  }
  providers: Record<string, unknown>
}

const LIBRE: ProviderDescriptorDto = {
  id: 'libretranslate',
  displayName: 'LibreTranslate',
  description: '',
  settingsFields: [],
  secretFields: [],
}

const calls: string[] = []
type ListProviders = () => Promise<ProviderDescriptorDto[]>
const mockList: Mock<ListProviders> = vi.fn<ListProviders>(async () => {
  calls.push('providers.list')

  return [LIBRE]
})
const mockSettingsGet: Mock<() => Promise<SettingsPayload>> = vi.fn()

vi.mock('@app/composables/useApi', () => ({
  useApi: () => ({
    providers: { list: mockList },
    settings: { get: mockSettingsGet },
  }),
}))

const { useProviderSession }: typeof UseProviderSessionModule = await import(
  '@app/composables/useProviderSession'
)

function settingsWith(providerId: string | null, enabled: boolean): SettingsPayload {
  return {
    app: {
      activeProvider: {
        providerId,
        sourceSelection: { mode: 'auto' },
        targetLanguage: 'ru',
      },
    },
    providers: { libretranslate: { enabled } },
  }
}

describe('useProviderSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    calls.length = 0
    mockSettingsGet.mockImplementation(async (): Promise<SettingsPayload> => {
      calls.push('settings.get')

      return settingsWith('libretranslate', true)
    })
  })

  it('loads the catalog, restores the selection, then awaits the provider switch', async () => {
    let finishSwitch: () => void = (): void => undefined
    const switchProvider: Mock<(id: string) => Promise<void>> = vi.fn(
      (id: string): Promise<void> => new Promise<void>((resolve: () => void) => {
        calls.push(`switch:${id}`)
        finishSwitch = resolve
      }),
    )
    let settled: boolean = false

    const hydration: Promise<void> = useProviderSession().hydrateProviderSession(switchProvider)
      .then((): void => {
        settled = true
      })
    await vi.waitFor((): void => {
      expect(switchProvider).toHaveBeenCalledWith('libretranslate')
    })

    expect(settled).toBe(false)
    finishSwitch()
    await hydration

    expect(settled).toBe(true)
    expect(calls).toEqual(['providers.list', 'settings.get', 'settings.get', 'switch:libretranslate'])
  })

  it('resolves without switching when no provider is configured', async () => {
    mockSettingsGet.mockResolvedValue(settingsWith(null, false))
    const switchProvider: Mock<(id: string) => Promise<void>> = vi.fn(
      async (): Promise<void> => undefined,
    )

    await useProviderSession().hydrateProviderSession(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })
})
