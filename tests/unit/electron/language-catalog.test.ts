import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  createLanguageCatalog,
} from '@electron/services/language-catalog/catalog'
import type {
  Language,
} from '@shared/types/language'
import type {
  TranslationProvider,
} from '@shared/providers/contract'

const LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    providerCode: 'en',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'de',
    name: 'German',
    providerCode: 'de',
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

function fakeAdapter(providerId: string, languages: Language[]): TranslationProvider {
  return {
    id: providerId as 'google' | 'libretranslate',
    getSupportedLanguages: async () => languages,
    getHealth: async () => ({
      ok: true,
    }),
    detectLanguage: async () => ({
      detectedLanguage: 'en',
    }),
    translateText: async () => ({
      translatedText: '',
      provider: providerId as 'google' | 'libretranslate',
    }),
    supportsDocumentTranslation: async () => false,
    getCapabilities: async () => ({
      textTranslation: true,
      languageDetection: true,
      supportedLanguagesDiscovery: true,
      documentTranslation: false,
    }),
  }
}

describe('language catalog', () => {
  let catalog: ReturnType<typeof createLanguageCatalog>

  beforeEach(() => {
    catalog = createLanguageCatalog()
  })

  it('returns empty array for uncached provider', () => {
    expect(catalog.getLanguages('unknown')).toEqual([])
  })

  it('refreshLanguages caches and returns the list', async () => {
    const adapter = fakeAdapter('google', LANGUAGES)
    const result = await catalog.refreshLanguages(adapter)

    expect(result).toHaveLength(3)
    expect(catalog.getLanguages('google')).toHaveLength(3)
  })

  it('clear removes all cached entries', async () => {
    const adapter = fakeAdapter('google', LANGUAGES)
    await catalog.refreshLanguages(adapter)
    catalog.clear()

    expect(catalog.getLanguages('google')).toEqual([])
  })
})

describe('revalidateSelection', () => {
  let catalog: ReturnType<typeof createLanguageCatalog>

  beforeEach(() => {
    catalog = createLanguageCatalog()
  })

  it('keeps valid explicit source and target unchanged', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'explicit',
          code: 'en',
        },
        target: 'de',
      },
      LANGUAGES,
    )

    expect(result.source).toEqual({
      mode: 'explicit',
      code: 'en',
    })
    expect(result.target).toBe('de')
  })

  it('keeps auto source unchanged', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'auto',
        },
        target: 'en',
      },
      LANGUAGES,
    )

    expect(result.source).toEqual({
      mode: 'auto',
    })
  })

  it('resets explicit source to auto when code not in catalog', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'explicit',
          code: 'xx',
        },
        target: 'en',
      },
      LANGUAGES,
    )

    expect(result.source).toEqual({
      mode: 'auto',
    })
  })

  it('resets target to first available when code not in catalog', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'auto',
        },
        target: 'xx',
      },
      LANGUAGES,
    )

    expect(result.target).toBe('en')
  })

  it('resets target to null when no target-capable languages exist', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'auto',
        },
        target: 'xx',
      },
      [
        {
          code: 'ja',
          name: 'Japanese',
          providerCode: 'ja',
          supportsSource: true,
          supportsTarget: false,
        },
      ],
    )

    expect(result.target).toBeNull()
  })

  it('keeps null target as null', () => {
    const result = catalog.revalidateSelection(
      {
        source: {
          mode: 'auto',
        },
        target: null,
      },
      LANGUAGES,
    )

    expect(result.target).toBeNull()
  })
})
