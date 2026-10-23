const DOCUMENT_EXTENSION_RE: RegExp = /^\.[a-z0-9]{1,16}$/

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
 * and malformed entries, normalizes each extension and removes duplicates
 * while keeping the provider's order.
 */
export function normalizeDocumentFormats(values: readonly unknown[]): string[] {
  const formats: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const extension: string | null = normalizeDocumentExtension(value)

    if (extension !== null && !formats.includes(extension)) {
      formats.push(extension)
    }
  }

  return formats
}
