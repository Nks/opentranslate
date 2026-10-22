import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  createTranslationOrchestrator,
} from '@electron/services/translation/orchestrator'
import type {
  TranslationProvider,
} from '@shared/providers/contract'
import type {
  TranslationInput,
  TranslationOutput,
} from '@shared/types/translation'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

function createFakeAdapter(delay = 0): TranslationProvider {
  return {
    id: 'google',
    async getHealth() {
      return {
        ok: true,
      }
    },
    async getSupportedLanguages() {
      return []
    },
    async detectLanguage(text: string) {
      return {
        detectedLanguage: text.startsWith('hola') ? 'es' : 'en',
      }
    },
    async translateText(input: TranslationInput): Promise<TranslationOutput> {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      return {
        translatedText: `[${input.targetLanguage}] ${input.text}`,
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

describe('translation orchestrator', () => {
  let orchestrator: ReturnType<typeof createTranslationOrchestrator>

  beforeEach(() => {
    orchestrator = createTranslationOrchestrator()
  })

  it('throws when no adapter is set', async () => {
    try {
      await orchestrator.translate({
        text: 'hello',
        source: {
          mode: 'auto',
        },
        targetLanguage: 'de',
      })
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.InternalAppError)
    }
  })

  it('translates text through the adapter', async () => {
    const adapter = createFakeAdapter()
    orchestrator.setAdapter(adapter)
    const result = await orchestrator.translate({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    expect(result).not.toBeNull()
    expect(result!.translatedText).toBe('[de] hello')
    expect(result!.provider).toBe('google')
  })

  it('detects language through the adapter', async () => {
    const adapter = createFakeAdapter()
    orchestrator.setAdapter(adapter)
    const result = await orchestrator.detect('hola mundo')

    expect(result.detectedLanguage).toBe('es')
  })

  it('returns null for stale requests (latest-wins)', async () => {
    const adapter = createFakeAdapter(50)
    orchestrator.setAdapter(adapter)

    const stalePromise = orchestrator.translate({
      text: 'stale',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    // Fire second request immediately → cancels the first
    const freshPromise = orchestrator.translate({
      text: 'fresh',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    const [staleResult, freshResult] = await Promise.all([stalePromise, freshPromise])

    // Stale request returns null (superseded)
    expect(staleResult).toBeNull()
    // Fresh request succeeds
    expect(freshResult).not.toBeNull()
    expect(freshResult!.translatedText).toBe('[de] fresh')
  })

  it('cancel() aborts the in-flight request', async () => {
    const adapter = createFakeAdapter(100)
    orchestrator.setAdapter(adapter)

    const promise = orchestrator.translate({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    orchestrator.cancel()
    const result = await promise

    expect(result).toBeNull()
  })

  it('setAdapter cancels any in-flight request', async () => {
    const adapter1 = createFakeAdapter(100)
    const adapter2 = createFakeAdapter()
    orchestrator.setAdapter(adapter1)

    const promise = orchestrator.translate({
      text: 'hello',
      source: {
        mode: 'auto',
      },
      targetLanguage: 'de',
    })

    orchestrator.setAdapter(adapter2)
    const result = await promise

    expect(result).toBeNull()
    expect(orchestrator.getAdapter()).toBe(adapter2)
  })

  it('detect throws when no adapter is set', async () => {
    try {
      await orchestrator.detect('hello')
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
    }
  })
})
