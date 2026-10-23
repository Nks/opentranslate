import {
  describe, expect, it,
} from 'vitest'
import {
  MAX_DOCUMENT_FORMATS,
  normalizeDocumentExtension,
  normalizeDocumentFormats,
} from '@shared/documents/formats'
import {
  MAX_DOCUMENT_DOWNLOAD_BYTES,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from '@shared/documents/limits'

describe('normalizeDocumentExtension', () => {
  it('lowercases and keeps a leading dot', () => {
    expect(normalizeDocumentExtension('.PDF')).toBe('.pdf')
  })

  it('adds the leading dot when the provider omits it', () => {
    expect(normalizeDocumentExtension('docx')).toBe('.docx')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDocumentExtension('  .txt ')).toBe('.txt')
  })

  it.each(['', '.', '..', '../etc', '.tar.gz', '.p d f', 'a/b', '.toolongextension0'])(
    'rejects malformed extension %j',
    (value: string) => {
      expect(normalizeDocumentExtension(value)).toBeNull()
    },
  )
})

describe('normalizeDocumentFormats', () => {
  it('normalizes, dedupes and drops non-string or malformed entries', () => {
    const formats: string[] = normalizeDocumentFormats(['.txt', 'TXT', 'pdf', 42, null, '../x', '.docx'])

    expect(formats).toEqual(['.txt', '.pdf', '.docx'])
  })

  it('caps the list at MAX_DOCUMENT_FORMATS distinct entries', () => {
    const many: string[] = Array.from({ length: 200 }, (_value: unknown, index: number): string => `.f${index}`)

    const formats: string[] = normalizeDocumentFormats([...many, ...many])

    expect(formats).toHaveLength(MAX_DOCUMENT_FORMATS)
    expect(new Set(formats).size).toBe(MAX_DOCUMENT_FORMATS)
    expect(formats[0]).toBe('.f0')
  })

  it('returns an empty list for an empty input', () => {
    expect(normalizeDocumentFormats([])).toEqual([])
  })
})

describe('document limits', () => {
  it('caps provider formats at 64 entries', () => {
    expect(MAX_DOCUMENT_FORMATS).toBe(64)
  })

  it('caps uploads at 50 MiB', () => {
    expect(MAX_DOCUMENT_UPLOAD_BYTES).toBe(50 * 1024 * 1024)
  })

  it('caps downloads at 100 MiB', () => {
    expect(MAX_DOCUMENT_DOWNLOAD_BYTES).toBe(100 * 1024 * 1024)
  })
})
