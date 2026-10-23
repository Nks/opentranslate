import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  mkdtemp, readdir, readFile, realpath, rm, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildOutputFilename, createDocumentService, type DocumentStatus,
} from '@electron/services/documents/service'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import type {
  DocumentTranslationInput, DocumentTranslationOutput, TranslationProvider,
} from '@shared/providers/contract'
import {
  PROVIDER_BYTES_OUTPUT,
  documentAdapter,
  type TranslateDocumentFn,
} from './support/document-adapter'

/** Normalize path separators so tests pass on Windows (backslash) and Unix (forward slash). */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

describe('buildOutputFilename', () => {
  it('inserts target lang and .translated before extension', () => {
    expect(normalizePath(buildOutputFilename('/docs/report.pdf', 'es')))
      .toBe('/docs/report.es.translated.pdf')
  })

  it('handles files without extension', () => {
    expect(normalizePath(buildOutputFilename('/docs/readme', 'de')))
      .toBe('/docs/readme.de.translated')
  })

  it('handles nested directories', () => {
    expect(normalizePath(buildOutputFilename('/a/b/c/file.docx', 'fr')))
      .toBe('/a/b/c/file.fr.translated.docx')
  })
})

describe('document service', () => {
  it('throws when no adapter is set', async () => {
    const service = createDocumentService({ getAdapter: () => null })

    try {
      await service.translate({
        filePath: '/tmp/test.pdf',
        sourceLanguage: { mode: 'auto' },
        targetLanguage: 'es',
      })
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.InternalAppError)
    }
  })

  it('throws when provider does not support documents', async () => {
    const adapter: TranslationProvider = {
      id: 'google',
      getHealth: async () => ({ ok: true }),
      getSupportedLanguages: async () => [],
      detectLanguage: async () => ({ detectedLanguage: 'en' }),
      translateText: async () => ({
        translatedText: '',
        provider: 'google',
      }),
      supportsDocumentTranslation: async () => false,
      getCapabilities: async () => ({
        textTranslation: true,
        languageDetection: true,
        supportedLanguagesDiscovery: true,
        documentTranslation: false,
      }),
    }

    const service = createDocumentService({ getAdapter: () => adapter })

    try {
      await service.translate({
        filePath: '/tmp/test.pdf',
        sourceLanguage: { mode: 'auto' },
        targetLanguage: 'es',
      })
      expect.fail('expected throw')
    } catch (err) {
      expect((err as AppError).category).toBe(ErrorCategory.UnsupportedDocumentType)
    }
  })

  it('status reports unsupported when no adapter', async () => {
    const service = createDocumentService({ getAdapter: () => null })

    expect((await service.status()).supported).toBe(false)
  })
})

describe('document service status', () => {
  it('reports the provider formats when documents are supported', async () => {
    const service = createDocumentService({ getAdapter: () => documentAdapter() })
    const status: DocumentStatus = await service.status()

    expect(status.supported).toBe(true)
    expect(status.formats).toEqual(['.txt', '.pdf'])
    expect(status.message).toBe('Document translation available')
  })

  it('reports unsupported when the capability probe says no', async () => {
    const adapter: TranslationProvider = documentAdapter({ supported: false })
    const service = createDocumentService({ getAdapter: () => adapter })

    expect(await service.status()).toMatchObject({
      supported: false,
      formats: [],
    })
  })

  it('reports unsupported when the provider lists no formats', async () => {
    const service = createDocumentService({ getAdapter: () => documentAdapter({ formats: [] }) })

    expect((await service.status()).supported).toBe(false)
  })
})

describe('document service translate', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-svc-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('uploads the validated file and saves the provider bytes next to it', async () => {
    const sourcePath: string = join(dir, 'report.txt')
    await writeFile(sourcePath, 'hello')
    const translateDocument = vi.fn<TranslateDocumentFn>(async () => PROVIDER_BYTES_OUTPUT)
    const adapter: TranslationProvider = documentAdapter({ translateDocument })
    const service = createDocumentService({ getAdapter: () => adapter })

    const result = await service.translate({
      filePath: sourcePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })

    const sent: DocumentTranslationInput | undefined = translateDocument.mock.calls[0]?.[0]
    expect(sent?.fileName).toBe('report.txt')
    expect(Buffer.from(sent?.content ?? []).toString('utf8')).toBe('hello')
    expect(sent?.targetLanguage).toBe('ru')
    expect(result).toEqual({
      outputPath: join(dir, 'report.ru.translated.txt'),
      provider: 'libretranslate',
    })
    expect(Array.from(await readFile(result.outputPath))).toEqual([0x54, 0x00, 0xff])
  })

  it('rejects an extension the provider does not list before uploading', async () => {
    const sourcePath: string = join(dir, 'report.pdf')
    await writeFile(sourcePath, 'pdf')
    const translateDocument = vi.fn<TranslateDocumentFn>()
    const service = createDocumentService({
      getAdapter: () => documentAdapter({
        formats: ['.txt', '.docx'],
        translateDocument,
      }),
    })

    await expect(service.translate({
      filePath: sourcePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toMatchObject({
      category: ErrorCategory.UnsupportedDocumentType,
      message: expect.stringContaining('Supported formats: .txt, .docx'),
    })
    expect(translateDocument).not.toHaveBeenCalled()
  })

  it('rejects when the provider reports no formats', async () => {
    const sourcePath: string = join(dir, 'report.txt')
    await writeFile(sourcePath, 'x')
    const service = createDocumentService({ getAdapter: () => documentAdapter({ formats: [] }) })

    await expect(service.translate({
      filePath: sourcePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toMatchObject({ category: ErrorCategory.UnsupportedDocumentType })
  })

  it('passes normalized provider errors through and writes nothing', async () => {
    const sourcePath: string = join(dir, 'report.txt')
    await writeFile(sourcePath, 'x')
    const service = createDocumentService({
      getAdapter: () => documentAdapter({
        translateDocument: async (): Promise<DocumentTranslationOutput> => {
          throw new AppError(ErrorCategory.RateLimited, 'libretranslate: http 429 — slow down')
        },
      }),
    })

    await expect(service.translate({
      filePath: sourcePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toMatchObject({ category: ErrorCategory.RateLimited })
    expect(await readdir(dir)).toEqual(['report.txt'])
  })

  it('normalizes an unexpected raw error into InternalAppError', async () => {
    const sourcePath: string = join(dir, 'report.txt')
    await writeFile(sourcePath, 'x')
    const service = createDocumentService({
      getAdapter: () => documentAdapter({
        translateDocument: async (): Promise<DocumentTranslationOutput> => {
          throw new TypeError('boom')
        },
      }),
    })

    const promise = service.translate({
      filePath: sourcePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({ category: ErrorCategory.InternalAppError })
  })
})
