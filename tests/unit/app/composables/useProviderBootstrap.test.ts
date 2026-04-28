// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach, vi,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { useProviderBootstrap } from '@app/composables/useProviderBootstrap'

describe('useProviderBootstrap.maybeAutoSelectProvider', () => {
  let providersStore: ReturnType<typeof useProvidersStore>
  let switchProvider: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    providersStore = useProvidersStore()
    switchProvider = vi.fn()
  })

  it('auto-selects the first enabled descriptor when none is active', () => {
    providersStore.descriptors = [
      {
        id: 'google',
        displayName: 'Google',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
      {
        id: 'libretranslate',
        displayName: 'Libre',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
    ]
    providersStore.providerSettings = {
      google: { enabled: false },
      libretranslate: { enabled: true },
    }

    const { maybeAutoSelectProvider } = useProviderBootstrap()
    maybeAutoSelectProvider(switchProvider)

    expect(switchProvider).toHaveBeenCalledWith('libretranslate')
  })

  it('does not auto-select when a provider is already active', () => {
    providersStore.descriptors = [
      {
        id: 'google',
        displayName: 'Google',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
    ]
    providersStore.providerSettings = { google: { enabled: true } }
    providersStore.activeProviderId = 'google'

    const { maybeAutoSelectProvider } = useProviderBootstrap()
    maybeAutoSelectProvider(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })

  it('does not auto-select when no descriptor is enabled', () => {
    providersStore.descriptors = [
      {
        id: 'google',
        displayName: 'Google',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
    ]
    providersStore.providerSettings = { google: { enabled: false } }

    const { maybeAutoSelectProvider } = useProviderBootstrap()
    maybeAutoSelectProvider(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })

  it('does not auto-select when descriptors list is empty', () => {
    const { maybeAutoSelectProvider } = useProviderBootstrap()
    maybeAutoSelectProvider(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })
})
