import {
  describe, expect, it,
} from 'vitest'
import type {
  TranslationProvider,
  TranslationInput,
  TranslationOutput,
  ProviderCapabilities,
  Language,
  HealthStatus,
  LanguageDetectionResult,
} from '@shared/providers/contract'

class FakeProvider implements TranslationProvider {
  readonly id = 'google' as const

  async getHealth(): Promise<HealthStatus> {
    return {
      ok: true,
    }
  }

  async getSupportedLanguages(): Promise<Language[]> {
    return [
      {
        code: 'en',
        name: 'English',
        providerCode: 'en',
        supportsSource: true,
        supportsTarget: true,
      },
    ]
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    return {
      detectedLanguage: text.length > 0 ? 'en' : 'und',
    }
  }

  async translateText(input: TranslationInput): Promise<TranslationOutput> {
    return {
      translatedText: `[${input.targetLanguage}] ${input.text}`,
      detectedSourceLanguage: 'en',
      provider: this.id,
    }
  }

  async supportsDocumentTranslation(): Promise<boolean> {
    return false
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      textTranslation: true,
      languageDetection: true,
      supportedLanguagesDiscovery: true,
      documentTranslation: false,
    }
  }
}

describe('TranslationProvider contract', () => {
  const provider: TranslationProvider = new FakeProvider()

  it('returns healthy', async () => {
    await expect(provider.getHealth()).resolves.toEqual({
      ok: true,
    })
  })

  it('returns supported languages', async () => {
    const langs = await provider.getSupportedLanguages()
    expect(langs[0]?.code).toBe('en')
  })

  it('detects language', async () => {
    await expect(provider.detectLanguage('hello')).resolves.toEqual({
      detectedLanguage: 'en',
    })
  })

  it('translates text and stamps provider id', async () => {
    const out = await provider.translateText({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'es',
    })
    expect(out.provider).toBe('google')
    expect(out.translatedText).toContain('hello')
  })

  it('reports document capability', async () => {
    await expect(provider.supportsDocumentTranslation()).resolves.toBe(false)
    const caps = await provider.getCapabilities()
    expect(caps.documentTranslation).toBe(false)
  })
})
