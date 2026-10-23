import {
  describe, expect, it,
} from 'vitest'
import {
  documentBaseName,
  documentExtension,
} from '@shared/documents/file-name'

describe('documentBaseName', () => {
  it.each([
    ['/Users/me/report.pdf', 'report.pdf'],
    ['C:\\Users\\me\\report.docx', 'report.docx'],
    ['\\\\server\\share\\notes.txt', 'notes.txt'],
    ['relative/dir/file.odt', 'file.odt'],
    ['/trailing/slash/', 'slash'],
    ['plain.txt', 'plain.txt'],
  ])('returns the last segment of %s', (path: string, expected: string) => {
    expect(documentBaseName(path)).toBe(expected)
  })

  it('returns an empty string for an empty path', () => {
    expect(documentBaseName('')).toBe('')
  })
})

describe('documentExtension', () => {
  it.each([
    ['report.PDF', '.pdf'],
    ['archive.tar.gz', '.gz'],
    ['notes', ''],
    ['.bashrc', ''],
    ['trailing.', ''],
  ])('normalizes the extension of %s', (fileName: string, expected: string) => {
    expect(documentExtension(fileName)).toBe(expected)
  })
})
