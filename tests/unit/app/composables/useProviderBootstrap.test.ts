// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach, vi,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { useProviderBootstrap } from '@app/composables/useProviderBootstrap'

const GOOGLE_DESCRIPTOR = {
  id: 'google',
  displayName: 'Google',
  description: '',
  settingsFields: [],
  secretFields: [],
}

const LIBRE_DESCRIPTOR = {
  id: 'libretranslate',
  displayName: 'Libre',
  description: '',
  settingsFields: [],
  secretFields: [],
}

describe('useProviderBootstrap.ensureActiveProviderHydrated', () => {
  let providersStore: ReturnType<typeof useProvidersStore>
  let switchProvider: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    providersStore = useProvidersStore()
    switchProvider = vi.fn()
  })

  it('hydrates the persisted provider by calling switchProvider on cold start', () => {
    providersStore.descriptors = [GOOGLE_DESCRIPTOR, LIBRE_DESCRIPTOR]
    providersStore.providerSettings = {
      google: { enabled: true },
      libretranslate: { enabled: true },
    }
    providersStore.activeProviderId = 'google'

    const { ensureActiveProviderHydrated } = useProviderBootstrap()
    ensureActiveProviderHydrated(switchProvider)

    expect(switchProvider).toHaveBeenCalledWith('google')
  })

  it('auto-selects the first enabled descriptor when no provider is persisted', () => {
    providersStore.descriptors = [GOOGLE_DESCRIPTOR, LIBRE_DESCRIPTOR]
    providersStore.providerSettings = {
      google: { enabled: false },
      libretranslate: { enabled: true },
    }

    const { ensureActiveProviderHydrated } = useProviderBootstrap()
    ensureActiveProviderHydrated(switchProvider)

    expect(switchProvider).toHaveBeenCalledWith('libretranslate')
  })

  it('falls back to auto-select when persisted provider is unknown', () => {
    providersStore.descriptors = [LIBRE_DESCRIPTOR]
    providersStore.providerSettings = { libretranslate: { enabled: true } }
    providersStore.activeProviderId = 'google'

    const { ensureActiveProviderHydrated } = useProviderBootstrap()
    ensureActiveProviderHydrated(switchProvider)

    expect(switchProvider).toHaveBeenCalledWith('libretranslate')
  })

  it('does not call switchProvider when no descriptor is enabled', () => {
    providersStore.descriptors = [GOOGLE_DESCRIPTOR]
    providersStore.providerSettings = { google: { enabled: false } }

    const { ensureActiveProviderHydrated } = useProviderBootstrap()
    ensureActiveProviderHydrated(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })

  it('does not call switchProvider when descriptors list is empty', () => {
    const { ensureActiveProviderHydrated } = useProviderBootstrap()
    ensureActiveProviderHydrated(switchProvider)

    expect(switchProvider).not.toHaveBeenCalled()
  })
})
