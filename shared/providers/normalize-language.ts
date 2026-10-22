import type {
  Language,
} from '@shared/types/language'

export interface NormalizeLanguageInput {
  providerCode: string
  name: string
  code?: string
  supportsSource?: boolean
  supportsTarget?: boolean
}

/**
 * Normalize a provider-native language record into the canonical `Language`
 * shape used throughout the app.
 *
 * Defaults:
 *   - `code` falls back to `providerCode` (BCP-47 is the common case)
 *   - `supportsSource` and `supportsTarget` both default to `true`
 *
 * Every provider mapper is expected to pipe its native list through this
 * helper so the renderer never sees provider-shaped data.
 */
export function normalizeLanguage(input: NormalizeLanguageInput): Language {
  const trimmedProviderCode = input.providerCode.trim()

  if (trimmedProviderCode.length === 0) {
    throw new Error('normalizeLanguage: providerCode must be non-empty')
  }
  const trimmedName = input.name.trim()

  if (trimmedName.length === 0) {
    throw new Error('normalizeLanguage: name must be non-empty')
  }

  return {
    code: (input.code ?? trimmedProviderCode).trim(),
    name: trimmedName,
    providerCode: trimmedProviderCode,
    supportsSource: input.supportsSource ?? true,
    supportsTarget: input.supportsTarget ?? true,
  }
}
