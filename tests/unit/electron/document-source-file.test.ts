import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest'
import {
  mkdir, mkdtemp, realpath, rm, symlink, truncate, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertSupportedExtension,
  readSourceDocument,
  resolveSourceDocument,
  type SourceDocument,
} from '@electron/services/documents/source-file'
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
} from '@shared/documents/limits'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const IS_WINDOWS: boolean = process.platform === 'win32'

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  const err: unknown = await promise.then(
    (): never => {
      throw new Error('expected rejection')
    },
    (caught: unknown): unknown => caught,
  )

  expect(err).toBeInstanceOf(AppError)

  return err as AppError
}

describe('resolveSourceDocument', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-src-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('resolves an absolute regular file to its real path and normalized extension', async () => {
    const filePath: string = join(dir, 'Report.PDF')
    await writeFile(filePath, 'pdf-bytes')

    const document: SourceDocument = await resolveSourceDocument(filePath)

    expect(document.path).toBe(filePath)
    expect(document.fileName).toBe('Report.PDF')
    expect(document.extension).toBe('.pdf')
    expect(document.sizeBytes).toBe(9)
  })

  it('rejects a relative path as InternalAppError', async () => {
    const err: AppError = await rejection(resolveSourceDocument(join('docs', 'report.pdf')))

    expect(err.category).toBe(ErrorCategory.InternalAppError)
    expect(err.message).toContain('absolute')
  })

  it.each(['\\\\attacker\\share\\notes.txt', '//attacker/share/notes.txt'])(
    'rejects network path %s before touching the filesystem',
    async (networkPath: string) => {
      const err: AppError = await rejection(resolveSourceDocument(networkPath))

      expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
      expect(err.message).toContain('network')
    },
  )

  it('rejects a missing file without echoing the path', async () => {
    const missing: string = join(dir, 'secret-name.pdf')
    const err: AppError = await rejection(resolveSourceDocument(missing))

    expect(err.category).toBe(ErrorCategory.InternalAppError)
    expect(err.message).not.toContain('secret-name')
  })

  it('rejects a directory as UnsupportedDocumentType', async () => {
    const folder: string = join(dir, 'folder.pdf')
    await mkdir(folder)

    const err: AppError = await rejection(resolveSourceDocument(folder))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(err.message).toContain('regular file')
  })

  it.skipIf(IS_WINDOWS)('rejects a character device', async () => {
    const err: AppError = await rejection(resolveSourceDocument('/dev/null'))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
  })

  it('rejects an empty file', async () => {
    const filePath: string = join(dir, 'empty.txt')
    await writeFile(filePath, '')

    const err: AppError = await rejection(resolveSourceDocument(filePath))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(err.message).toContain('empty')
  })

  it('rejects a file above the upload cap', async () => {
    const filePath: string = join(dir, 'huge.txt')
    await writeFile(filePath, '')
    await truncate(filePath, MAX_DOCUMENT_UPLOAD_BYTES + 1)

    const err: AppError = await rejection(resolveSourceDocument(filePath))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(err.message).toContain('50 MiB')
  })

  it('accepts a file exactly at the upload cap', async () => {
    const filePath: string = join(dir, 'limit.txt')
    await writeFile(filePath, '')
    await truncate(filePath, MAX_DOCUMENT_UPLOAD_BYTES)

    const document: SourceDocument = await resolveSourceDocument(filePath)

    expect(document.sizeBytes).toBe(MAX_DOCUMENT_UPLOAD_BYTES)
  })

  it.skipIf(IS_WINDOWS)('follows a symlink and validates the real target', async () => {
    const target: string = join(dir, 'notes')
    const link: string = join(dir, 'notes.pdf')
    await writeFile(target, 'no extension')
    await symlink(target, link)

    const document: SourceDocument = await resolveSourceDocument(link)

    expect(document.path).toBe(target)
    expect(document.extension).toBe('')
  })
})

describe('assertSupportedExtension', () => {
  const DOCUMENT: SourceDocument = {
    path: '/docs/report.pdf',
    fileName: 'report.pdf',
    extension: '.pdf',
    sizeBytes: 10,
  }

  it('accepts an extension the provider lists', () => {
    expect(() => assertSupportedExtension(DOCUMENT, ['.txt', '.pdf'])).not.toThrow()
  })

  it('rejects an unlisted extension and names the supported formats', () => {
    expect(() => assertSupportedExtension(DOCUMENT, ['.txt', '.docx'])).toThrow(
      expect.objectContaining({
        category: ErrorCategory.UnsupportedDocumentType,
        message: expect.stringContaining('Supported formats: .txt, .docx'),
      }),
    )
  })

  it('rejects a file without extension', () => {
    expect(() => assertSupportedExtension({
      ...DOCUMENT,
      extension: '',
    }, ['.txt'])).toThrow(expect.objectContaining({
      category: ErrorCategory.UnsupportedDocumentType,
    }))
  })
})

describe('readSourceDocument', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-read-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('reads the validated file bytes', async () => {
    const filePath: string = join(dir, 'a.txt')
    await writeFile(filePath, Buffer.from([7, 8, 9]))

    const bytes: Uint8Array = await readSourceDocument(await resolveSourceDocument(filePath))

    expect(Array.from(bytes)).toEqual([7, 8, 9])
  })

  it('rejects a file that grew past the cap after validation', async () => {
    const filePath: string = join(dir, 'grows.txt')
    await writeFile(filePath, 'x')
    const document: SourceDocument = await resolveSourceDocument(filePath)
    await truncate(filePath, MAX_DOCUMENT_UPLOAD_BYTES + 1)

    const err: AppError = await rejection(readSourceDocument(document))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
  })
})
