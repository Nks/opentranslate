import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'

export function reconcileTarget(
  previous: string | null,
  fromMain: string | null,
  languages: Language[],
): string | null {
  if (previous === null) {
    return fromMain
  }

  const isStillSupported = languages.some(
    (lang: Language): boolean => lang.supportsTarget && lang.code === previous,
  )

  return isStillSupported ? previous : fromMain
}

export function reconcileSource(
  previous: SourceLanguageSelection,
  fromMain: SourceLanguageSelection,
  languages: Language[],
): SourceLanguageSelection {
  if (previous.mode === 'auto') {
    return fromMain
  }

  const isStillSupported = languages.some(
    (lang: Language): boolean => lang.supportsSource && lang.code === previous.code,
  )

  return isStillSupported ? previous : fromMain
}
