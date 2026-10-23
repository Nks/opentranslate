import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  mkdtemp, realpath, rm, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createDocumentService, type DocumentService,
} from '@electron/services/documents/service'
import { ErrorCategory } from '@shared/errors'
import type { TranslationProvider } from '@shared/providers/contract'
import {
  documentAdapter,
  type TranslateDocumentFn,
} from './support/document-adapter'

describe('document service inspect', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-inspect-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  function serviceFor(adapter: TranslationProvider | null): DocumentService {
    return createDocumentService({ getAdapter: () => adapter })
  }

  it('accepts a local regular file with a supported extension without uploading it', async () => {
    const filePath: string = join(dir, 'notes.txt')
    await writeFile(filePath, 'hello')
    const translateDocument = vi.fn<TranslateDocumentFn>()

    await expect(serviceFor(documentAdapter({ translateDocument })).inspect(filePath))
      .resolves.toBeUndefined()
    expect(translateDocument).not.toHaveBeenCalled()
  })

  it.each([
    ['a network path', '\\\\attacker\\share\\notes.txt', ErrorCategory.UnsupportedDocumentType],
    ['a relative path', join('docs', 'notes.txt'), ErrorCategory.InternalAppError],
  ])('rejects %s', async (_label: string, filePath: string, category: string) => {
    await expect(serviceFor(documentAdapter()).inspect(filePath))
      .rejects.toMatchObject({ category })
  })

  it('rejects a missing file', async () => {
    await expect(serviceFor(documentAdapter()).inspect(join(dir, 'missing.txt')))
      .rejects.toMatchObject({ category: ErrorCategory.InternalAppError })
  })

  it('rejects an extension the provider does not list, naming the supported formats', async () => {
    const filePath: string = join(dir, 'report.pdf')
    await writeFile(filePath, '%PDF')

    await expect(serviceFor(documentAdapter({ formats: ['.txt'] })).inspect(filePath))
      .rejects.toMatchObject({
        category: ErrorCategory.UnsupportedDocumentType,
        message: expect.stringContaining('Supported formats: .txt'),
      })
  })

  it('rejects when no provider is active', async () => {
    await expect(serviceFor(null).inspect(join(dir, 'notes.txt')))
      .rejects.toMatchObject({ category: ErrorCategory.InternalAppError })
  })
})
