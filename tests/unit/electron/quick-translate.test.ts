import {
  describe, expect, it, beforeEach,
} from 'vitest'
import { createQuickTranslateService } from '@electron/services/quick-translate/service'
import { createTranslationOrchestrator } from '@electron/services/translation/orchestrator'
import type { TranslationProvider } from '@shared/providers/contract'
import type {
  TranslationInput, TranslationOutput,
} from '@shared/types/translation'

function createFakeAdapter(): TranslationProvider {
  return {
    id: 'google',
    async getHealth() {
      return { ok: true }
    },
    async getSupportedLanguages() {
      return []
    },
    async detectLanguage() {
      return { detectedLanguage: 'en' }
    },
    async translateText(input: TranslationInput): Promise<TranslationOutput> {
      return {
        translatedText: `[${input.targetLanguage}] ${input.text}`,
        detectedSourceLanguage: 'en',
        provider: 'google',
      }
    },
    async supportsDocumentTranslation() {
      return false
    },
    async getCapabilities() {
      return {
        textTranslation: true,
        languageDetection: true,
        supportedLanguagesDiscovery: true,
        documentTranslation: false,
      }
    },
  }
}

describe('quick translate service', () => {
  let service: ReturnType<typeof createQuickTranslateService>

  beforeEach(() => {
    const orchestrator = createTranslationOrchestrator()
    orchestrator.setAdapter(createFakeAdapter())
    service = createQuickTranslateService({ orchestrator })
  })

  it('translates clipboard text and returns structured result', async () => {
    const result = await service.translate('hello world', 'es')

    expect(result).not.toBeNull()
    expect(result!.sourceText).toBe('hello world')
    expect(result!.translatedText).toBe('[es] hello world')
    expect(result!.detectedSourceLanguage).toBe('en')
    expect(result!.targetLanguage).toBe('es')
    expect(result!.provider).toBe('google')
  })

  it('returns null for empty clipboard text', async () => {
    const result = await service.translate('   ', 'es')

    expect(result).toBeNull()
  })

  it('trims whitespace from clipboard text before translating', async () => {
    const result = await service.translate('  hello  ', 'de')

    expect(result).not.toBeNull()
    expect(result!.sourceText).toBe('hello')
  })
})
