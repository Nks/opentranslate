const DOCUMENT_EXTENSION_RE: RegExp = /^\.[a-z0-9]{1,16}$/

/** Most document formats accepted from a provider's capability report. */
export const MAX_DOCUMENT_FORMATS: number = 64

/**
 * Normalize a file extension to the canonical `.ext` lowercase form used to
 * compare a picked file against a provider's supported document formats.
 *
 * @returns The normalized extension, or `null` when the value is not a single
 *   alphanumeric extension (empty, multi-dot, path characters, whitespace).
 */
export function normalizeDocumentExtension(value: string): string | null {
  const trimmed: string = value.trim().toLowerCase()
  const dotted: string = trimmed.startsWith('.') ? trimmed : `.${trimmed}`

  return DOCUMENT_EXTENSION_RE.test(dotted) ? dotted : null
}

/**
 * Normalize a provider-reported list of document formats: drops non-string
 * and malformed entries, normalizes each extension, removes duplicates while
 * keeping the provider's order, and keeps at most `MAX_DOCUMENT_FORMATS`.
 */
export function normalizeDocumentFormats(values: readonly unknown[]): string[] {
  const formats: Set<string> = new Set()

  for (const value of values) {
    if (formats.size >= MAX_DOCUMENT_FORMATS) {
      break
    }

    const extension: string | null = typeof value === 'string'
      ? normalizeDocumentExtension(value)
      : null

    if (extension !== null) {
      formats.add(extension)
    }
  }

  return [...formats]
}
