// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  flushPromises, mount, type VueWrapper,
} from '@vue/test-utils'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'

const LIBRE: ProviderDescriptorDto = {
  id: 'libretranslate',
  displayName: 'LibreTranslate',
  description: '',
  settingsFields: [],
  secretFields: [],
}

const LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    providerCode: 'en',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'ru',
    name: 'Russian',
    providerCode: 'ru',
    supportsSource: true,
    supportsTarget: true,
  },
]

interface SettingsPayload {
  app: {
    activeProvider: {
      providerId: string | null
      sourceSelection: { mode: 'auto' }
      targetLanguage: string | null
    }
    targetHistory: string[]
  }
  providers: Record<string, unknown>
}

const calls: string[] = []

function tracked<TResult>(name: string, result: TResult) {
  return vi.fn(async (): Promise<TResult> => {
    calls.push(name)

    return result
  })
}

const api = {
  providers: {
    list: tracked('providers.list', [LIBRE]),
    switch: tracked('providers.switch', {
      languages: LANGUAGES,
      capabilities: {
        textTranslation: true,
        languageDetection: true,
        supportedLanguagesDiscovery: true,
        documentTranslation: true,
      },
      selection: {
        source: { mode: 'auto' },
        target: 'ru',
      },
      error: null,
    }),
  },
  settings: {
    get: tracked<SettingsPayload>('settings.get', {
      app: {
        activeProvider: {
          providerId: 'libretranslate',
          sourceSelection: { mode: 'auto' },
          targetLanguage: 'ru',
        },
        targetHistory: [],
      },
      providers: { libretranslate: { enabled: true } },
    }),
    update: tracked('settings.update', null),
  },
  translation: {
    translate: tracked('translation.translate', null),
    cancel: tracked('translation.cancel', undefined),
  },
  documents: {
    status: tracked('documents.status', {
      supported: true,
      formats: ['.txt'],
      message: 'Document translation available',
    }),
    pick: tracked('documents.pick', null),
    selectDroppedFile: tracked('documents.selectDroppedFile', { filePath: '/docs/dropped.txt' }),
    translate: tracked('documents.translate', null),
    reveal: tracked('documents.reveal', undefined),
  },
}

vi.mock('@app/composables/useApi', () => ({
  useApi: () => api,
}))

const { default: DocumentsPage } = await import('@app/pages/documents.vue')

const passthrough = { template: '<div><slot /></div>' }

const stubs = {
  UApp: passthrough,
  DocumentsHeader: {
    props: ['providers', 'activeProviderId', 'sourceSelection', 'targetLanguage'],
    emits: ['switch', 'source-change', 'target-change'],
    template: '<header data-testid="header" :data-active="activeProviderId" />',
  },
  DocumentCapability: {
    props: ['formats', 'supported'],
    template: '<div data-testid="capability" :data-formats="formats.join(\',\')" />',
  },
  DocumentDropZone: {
    props: ['fileName', 'disabled'],
    template: '<div data-testid="zone" :data-file="fileName" />',
  },
  DocumentTranslateAction: true,
  DocumentResult: true,
  DocumentErrorPanel: true,
  EmptyProviderState: { template: '<div data-testid="empty" />' },
  ProviderErrorBanner: true,
}

async function mountPage(): Promise<VueWrapper> {
  const wrapper: VueWrapper = mount(DocumentsPage, {
    attachTo: document.body,
    global: { stubs },
  })
  await flushPromises()

  return wrapper
}

describe('documents page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    calls.length = 0
  })

  it('bootstraps the provider on a cold start before checking document support', async () => {
    const wrapper: VueWrapper = await mountPage()

    expect(calls.indexOf('providers.list')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('providers.switch')).toBeLessThan(calls.indexOf('documents.status'))
    expect(wrapper.find('[data-testid="header"]').attributes('data-active')).toBe('libretranslate')
    expect(wrapper.find('[data-testid="capability"]').attributes('data-formats')).toBe('.txt')
    wrapper.unmount()
  })

  it('reuses an already hydrated provider without switching again', async () => {
    const store = useProvidersStore()
    store.descriptors = [LIBRE]
    store.providerSettings = { libretranslate: { enabled: true } }
    store.activeProviderId = 'libretranslate'

    const wrapper: VueWrapper = await mountPage()

    expect(calls).toEqual(['documents.status'])
    wrapper.unmount()
  })

  it('re-checks document support after the provider changes', async () => {
    const wrapper: VueWrapper = await mountPage()
    calls.length = 0

    wrapper.findComponent(stubs.DocumentsHeader).vm.$emit('switch', 'libretranslate')
    await flushPromises()

    expect(calls).toContain('providers.switch')
    expect(calls.at(-1)).toBe('documents.status')
    wrapper.unmount()
  })

  it('applies language picks from the header to the shared selection', async () => {
    const wrapper: VueWrapper = await mountPage()

    wrapper.findComponent(stubs.DocumentsHeader).vm.$emit('source-change', 'en')
    await flushPromises()

    expect(useProvidersStore().sourceSelection).toEqual({
      mode: 'explicit',
      code: 'en',
    })
    wrapper.unmount()
  })

  it('shows the empty state when no provider is configured', async () => {
    api.settings.get.mockResolvedValueOnce({
      app: {
        activeProvider: {
          providerId: null,
          sourceSelection: { mode: 'auto' },
          targetLanguage: null,
        },
        targetHistory: [],
      },
      providers: {},
    })

    const wrapper: VueWrapper = await mountPage()

    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('routes a file dropped anywhere on the page through the preload bridge', async () => {
    const wrapper: VueWrapper = await mountPage()
    const file: File = new File(['x'], 'dropped.txt')
    const drop: Event = new Event('drop', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        files: [file],
        types: ['Files'],
        items: [{
          kind: 'file',
          type: '',
        }],
      },
    })

    wrapper.find('[data-testid="header"]').element.dispatchEvent(drop)
    await flushPromises()

    expect(api.documents.selectDroppedFile).toHaveBeenCalledWith(file)
    expect(drop.defaultPrevented).toBe(true)
    expect(wrapper.find('[data-testid="zone"]').attributes('data-file')).toBe('dropped.txt')
    wrapper.unmount()
  })
})
