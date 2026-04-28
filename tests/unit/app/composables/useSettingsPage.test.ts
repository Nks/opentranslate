// @vitest-environment happy-dom
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import type * as UseSettingsPageModule from '@app/composables/useSettingsPage'

interface ApiSurface {
  settings: {
    get: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  providers: {
    list: ReturnType<typeof vi.fn>
    switch: ReturnType<typeof vi.fn>
  }
  secrets: {
    set: ReturnType<typeof vi.fn>
  }
  getPlatform: ReturnType<typeof vi.fn>
}

function installApi(api: ApiSurface): void {
  ;(window as unknown as { api: unknown }).api = api
}

function installToastStub(): void {
  ;(globalThis as Record<string, unknown>).useToast = (): {
    add: ReturnType<typeof vi.fn>
  } => ({
    add: vi.fn(),
  })
}

async function loadModule(): Promise<typeof UseSettingsPageModule> {
  vi.resetModules()

  return import('@app/composables/useSettingsPage')
}

function freshApi(): ApiSurface {
  return {
    settings: {
      get: vi.fn(async () => ({
        app: {},
        providers: {
          libretranslate: {
            enabled: false,
            endpoint: 'https://libretranslate.com',
          },
          google: {
            enabled: false,
            projectId: '',
          },
        },
      })),
      update: vi.fn(async () => ({
        app: {},
        providers: {},
      })),
    },
    providers: {
      list: vi.fn(),
      switch: vi.fn(),
    },
    secrets: {
      set: vi.fn(),
    },
    getPlatform: vi.fn(async () => 'darwin'),
  }
}

describe('useSettingsPage <-> providersStore sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installToastStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>).useToast
    delete (window as unknown as { api?: unknown }).api
  })

  it('loadSettings hydrates providersStore.providerSettings from disk', async () => {
    const api = freshApi()
    installApi(api)

    const { useSettingsPage } = await loadModule()
    const { useProvidersStore } = await import('@app/stores/providers')
    const providersStore = useProvidersStore()
    const page = useSettingsPage()
    await page.loadSettings()

    expect(providersStore.providerSettings.libretranslate?.enabled).toBe(false)
    expect(providersStore.providerSettings.google?.enabled).toBe(false)
    expect(api.settings.get).toHaveBeenCalledOnce()
  })

  it('onProviderFieldChange mirrors the new value to providersStore.providerSettings', async () => {
    const api = freshApi()
    installApi(api)

    const { useSettingsPage } = await loadModule()
    const { useProvidersStore } = await import('@app/stores/providers')
    const providersStore = useProvidersStore()
    const page = useSettingsPage()
    await page.loadSettings()

    expect(providersStore.providerSettings.libretranslate?.enabled).toBe(false)

    await page.onProviderFieldChange('libretranslate', 'enabled', true)

    expect(providersStore.providerSettings.libretranslate?.enabled).toBe(true)
    expect(api.settings.update).toHaveBeenCalledWith({
      providers: {
        libretranslate: expect.objectContaining({ enabled: true }),
      },
    })
  })

  it('flipping enabled true via onProviderFieldChange unblocks activeDescriptors', async () => {
    const api = freshApi()
    installApi(api)

    const { useSettingsPage } = await loadModule()
    const { useProvidersStore } = await import('@app/stores/providers')
    const providersStore = useProvidersStore()
    providersStore.descriptors = [
      {
        id: 'libretranslate',
        displayName: 'Libre',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
    ]

    const page = useSettingsPage()
    await page.loadSettings()
    expect(providersStore.activeDescriptors).toHaveLength(0)

    await page.onProviderFieldChange('libretranslate', 'enabled', true)

    expect(providersStore.activeDescriptors).toHaveLength(1)
  })
})
