import {
  describe, expect, it,
} from 'vitest'
import {
  buildOutputFilename, createDocumentService,
} from '@electron/services/documents/service'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import type { TranslationProvider } from '@shared/providers/contract'

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

  it('isSupported returns false when no adapter', async () => {
    const service = createDocumentService({ getAdapter: () => null })

    expect(await service.isSupported()).toBe(false)
  })
})
