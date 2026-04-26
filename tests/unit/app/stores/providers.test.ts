// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'

describe('providers store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with no active provider', () => {
    const store = useProvidersStore()

    expect(store.activeProviderId).toBeNull()
    expect(store.descriptors).toEqual([])
    expect(store.languages).toEqual([])
    expect(store.capabilities).toBeNull()
  })

  it('sourceLanguages filters languages that support source', () => {
    const store = useProvidersStore()
    store.languages = [
      {
        code: 'en',
        name: 'English',
        providerCode: 'en',
        supportsSource: true,
        supportsTarget: true,
      },
      {
        code: 'xx',
        name: 'TargetOnly',
        providerCode: 'xx',
        supportsSource: false,
        supportsTarget: true,
      },
    ]

    expect(store.sourceLanguages).toHaveLength(1)
    expect(store.sourceLanguages[0]?.code).toBe('en')
  })

  it('targetLanguages filters languages that support target', () => {
    const store = useProvidersStore()
    store.languages = [
      {
        code: 'en',
        name: 'English',
        providerCode: 'en',
        supportsSource: true,
        supportsTarget: true,
      },
      {
        code: 'ja',
        name: 'Japanese',
        providerCode: 'ja',
        supportsSource: true,
        supportsTarget: false,
      },
    ]

    expect(store.targetLanguages).toHaveLength(1)
    expect(store.targetLanguages[0]?.code).toBe('en')
  })

  it('activeDescriptor returns the matching descriptor', () => {
    const store = useProvidersStore()
    store.descriptors = [
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
    store.activeProviderId = 'libretranslate'

    expect(store.activeDescriptor?.displayName).toBe('Libre')
  })

  it('activeDescriptor returns null when no match', () => {
    const store = useProvidersStore()
    store.activeProviderId = 'nonexistent'

    expect(store.activeDescriptor).toBeNull()
  })

  it('defaults source selection to auto', () => {
    const store = useProvidersStore()

    expect(store.sourceSelection).toEqual({ mode: 'auto' })
  })

  it('exposes currentSelection as a snapshot of provider + selection state', () => {
    const store = useProvidersStore()
    store.activeProviderId = 'libretranslate'
    store.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    store.targetLanguage = 'fr'

    expect(store.currentSelection).toEqual({
      providerId: 'libretranslate',
      sourceSelection: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'fr',
    })
  })

  it('hydrateFromSelection adopts a known provider and its languages', () => {
    const store = useProvidersStore()
    store.descriptors = [
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

    store.hydrateFromSelection({
      providerId: 'libretranslate',
      sourceSelection: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'fr',
    })

    expect(store.activeProviderId).toBe('libretranslate')
    expect(store.sourceSelection).toEqual({
      mode: 'explicit',
      code: 'en',
    })
    expect(store.targetLanguage).toBe('fr')
  })

  it('hydrateFromSelection nulls activeProviderId when the persisted provider is unknown', () => {
    const store = useProvidersStore()
    store.descriptors = [
      {
        id: 'google',
        displayName: 'Google',
        description: '',
        settingsFields: [],
        secretFields: [],
      },
    ]

    store.hydrateFromSelection({
      providerId: 'libretranslate',
      sourceSelection: { mode: 'auto' },
      targetLanguage: 'de',
    })

    expect(store.activeProviderId).toBeNull()
    expect(store.sourceSelection).toEqual({ mode: 'auto' })
    expect(store.targetLanguage).toBe('de')
  })
})
