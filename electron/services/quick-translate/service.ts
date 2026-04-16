import type { TranslationOrchestrator } from '@electron/services/translation/orchestrator'
import type { TranslationOutput } from '@shared/types/translation'

export interface QuickTranslateResult {
  sourceText: string
  translatedText: string
  detectedSourceLanguage: string | null
  targetLanguage: string
  provider: string
}

export interface QuickTranslateService {
  translate: (
    clipboardText: string,
    targetLanguage: string,
  ) => Promise<QuickTranslateResult | null>
}

export interface QuickTranslateServiceDeps {
  orchestrator: TranslationOrchestrator
}

export function createQuickTranslateService(
  deps: QuickTranslateServiceDeps,
): QuickTranslateService {
  async function translate(
    clipboardText: string,
    targetLanguage: string,
  ): Promise<QuickTranslateResult | null> {
    const trimmed = clipboardText.trim()

    if (trimmed.length === 0) {
      return null
    }

    const result: TranslationOutput | null = await deps.orchestrator.translate({
      text: trimmed,
      source: { mode: 'auto' },
      targetLanguage,
    })

    if (!result) {
      return null
    }

    return {
      sourceText: trimmed,
      translatedText: result.translatedText,
      detectedSourceLanguage: result.detectedSourceLanguage ?? null,
      targetLanguage,
      provider: result.provider,
    }
  }

  return { translate }
}
