import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  mkdir, mkdtemp, open, realpath, rm, symlink, truncate, writeFile, type FileHandle,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertSupportedExtension,
  inspectSourceDocument,
  loadSourceDocument,
  readAtMost,
  type BoundedRead,
  type LoadedSourceDocument,
  type SourceDocument,
} from '@electron/services/documents/source-file'
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
} from '@shared/documents/limits'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const IS_WINDOWS: boolean = process.platform === 'win32'
const FORMATS: readonly string[] = ['.txt', '.pdf']

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

describe('inspectSourceDocument', () => {
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

  it('resolves a local regular file to its real path, name and normalized extension', async () => {
    const filePath: string = join(dir, 'Report.PDF')
    await writeFile(filePath, 'pdf-bytes')

    const document: SourceDocument = await inspectSourceDocument(filePath, FORMATS)

    expect(document).toEqual({
      path: filePath,
      fileName: 'Report.PDF',
      extension: '.pdf',
      sizeBytes: 9,
    })
  })

  it.each(['\\\\attacker\\share\\notes.txt', '//attacker/share/notes.txt'])(
    'rejects network path %s before touching the filesystem',
    async (networkPath: string) => {
      const err: AppError = await rejection(inspectSourceDocument(networkPath, FORMATS))

      expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
      expect(err.message).toContain('network')
    },
  )

  it('rejects a relative path as InternalAppError', async () => {
    const err: AppError = await rejection(inspectSourceDocument(join('docs', 'report.pdf'), FORMATS))

    expect(err.category).toBe(ErrorCategory.InternalAppError)
    expect(err.message).toContain('absolute')
  })

  it('rejects a missing file without echoing the path', async () => {
    const err: AppError = await rejection(inspectSourceDocument(join(dir, 'secret-name.pdf'), FORMATS))

    expect(err.category).toBe(ErrorCategory.InternalAppError)
    expect(err.message).not.toContain('secret-name')
  })

  it('rejects a directory', async () => {
    const folder: string = join(dir, 'folder.pdf')
    await mkdir(folder)

    const err: AppError = await rejection(inspectSourceDocument(folder, FORMATS))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(err.message).toContain('regular file')
  })

  it.skipIf(IS_WINDOWS)('rejects a character device', async () => {
    const err: AppError = await rejection(inspectSourceDocument('/dev/null', FORMATS))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
  })

  it.skipIf(IS_WINDOWS)('rejects a FIFO without blocking on open', async () => {
    const fifoPath: string = join(dir, 'pipe.txt')
    execFileSync('mkfifo', [fifoPath])

    const err: AppError = await rejection(inspectSourceDocument(fifoPath, FORMATS))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
  }, 5_000)

  it('rejects an empty file', async () => {
    const filePath: string = join(dir, 'empty.txt')
    await writeFile(filePath, '')

    const err: AppError = await rejection(inspectSourceDocument(filePath, FORMATS))

    expect(err.message).toContain('empty')
  })

  it('rejects a file above the upload cap and accepts one exactly at it', async () => {
    const over: string = join(dir, 'huge.txt')
    const limit: string = join(dir, 'limit.txt')
    await writeFile(over, '')
    await writeFile(limit, '')
    await truncate(over, MAX_DOCUMENT_UPLOAD_BYTES + 1)
    await truncate(limit, MAX_DOCUMENT_UPLOAD_BYTES)

    const err: AppError = await rejection(inspectSourceDocument(over, FORMATS))
    const document: SourceDocument = await inspectSourceDocument(limit, FORMATS)

    expect(err.message).toContain('50 MiB')
    expect(document.sizeBytes).toBe(MAX_DOCUMENT_UPLOAD_BYTES)
  })

  it('rejects an extension the provider does not list', async () => {
    const filePath: string = join(dir, 'slides.pptx')
    await writeFile(filePath, 'x')

    const err: AppError = await rejection(inspectSourceDocument(filePath, FORMATS))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(err.message).toContain('Supported formats: .txt, .pdf')
  })

  it.skipIf(IS_WINDOWS)('follows a symlink and validates the real target', async () => {
    const target: string = join(dir, 'notes')
    const link: string = join(dir, 'notes.pdf')
    await writeFile(target, 'no extension')
    await symlink(target, link)

    const err: AppError = await rejection(inspectSourceDocument(link, FORMATS))

    expect(err.message).toContain('without extension')
  })
})

describe('loadSourceDocument', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-load-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('reads the validated file bytes from the same handle it checked', async () => {
    const filePath: string = join(dir, 'a.txt')
    await writeFile(filePath, Buffer.from([7, 8, 9]))

    const loaded: LoadedSourceDocument = await loadSourceDocument(filePath, FORMATS)

    expect(loaded.document.fileName).toBe('a.txt')
    expect(Array.from(loaded.content)).toEqual([7, 8, 9])
  })

  it('validates the extension before reading', async () => {
    const filePath: string = join(dir, 'a.bin')
    await writeFile(filePath, 'x')

    const err: AppError = await rejection(loadSourceDocument(filePath, FORMATS))

    expect(err.category).toBe(ErrorCategory.UnsupportedDocumentType)
  })
})

describe('readAtMost', () => {
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

  async function readFrom(content: string, maxBytes: number): Promise<BoundedRead> {
    const filePath: string = join(dir, 'grows.txt')
    await writeFile(filePath, content)
    const handle: FileHandle = await open(filePath, 'r')

    try {
      return await readAtMost(handle, maxBytes)
    } finally {
      await handle.close()
    }
  }

  it('stops at cap + 1 bytes when the file is larger than allowed', async () => {
    expect(await readFrom('0123456789', 4)).toEqual({ kind: 'too-large' })
  })

  it('returns the whole content within the cap', async () => {
    const result: BoundedRead = await readFrom('0123', 4)

    expect(result.kind).toBe('complete')
    expect(result.kind === 'complete' ? Buffer.from(result.bytes).toString('utf8') : '').toBe('0123')
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
})
