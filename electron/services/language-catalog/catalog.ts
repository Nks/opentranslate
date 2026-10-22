import type {
  Language,
} from '@shared/types/language'
import type {
  TranslationProvider,
} from '@shared/providers/contract'
import type {
  SourceLanguageSelection,
} from '@shared/types/translation'

export interface LanguageSelection {
  source: SourceLanguageSelection
  target: string | null
}

export interface LanguageCatalog {
  refreshLanguages: (adapter: TranslationProvider) => Promise<Language[]>
  getLanguages: (providerId: string) => Language[]
  revalidateSelection: (
    current: LanguageSelection,
    languages: Language[],
  ) => LanguageSelection
  clear: () => void
}

export function createLanguageCatalog(): LanguageCatalog {
  const cache = new Map<string, Language[]>()

  function refreshLanguages(adapter: TranslationProvider): Promise<Language[]> {
    return adapter.getSupportedLanguages().then((languages) => {
      cache.set(adapter.id, languages)

      return languages
    })
  }

  function getLanguages(providerId: string): Language[] {
    return cache.get(providerId) ?? []
  }

  function revalidateSelection(
    current: LanguageSelection,
    languages: Language[],
  ): LanguageSelection {
    const targetCodes = new Set(
      languages.filter((lang) => lang.supportsTarget).map((lang) => lang.code),
    )
    const sourceCodes = new Set(
      languages.filter((lang) => lang.supportsSource).map((lang) => lang.code),
    )

    let validatedSource: SourceLanguageSelection = current.source

    if (current.source.mode === 'explicit' && !sourceCodes.has(current.source.code)) {
      validatedSource = {
        mode: 'auto',
      }
    }

    let validatedTarget: string | null = current.target

    if (current.target !== null && !targetCodes.has(current.target)) {
      const firstTarget = languages.find((lang) => lang.supportsTarget)
      validatedTarget = firstTarget?.code ?? null
    }

    return {
      source: validatedSource,
      target: validatedTarget,
    }
  }

  function clear(): void {
    cache.clear()
  }

  return {
    refreshLanguages,
    getLanguages,
    revalidateSelection,
    clear,
  }
}
