import type {
  TranslationProvider,
} from '@shared/providers/contract'
import type {
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
} from '@shared/types/translation'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

export interface TranslationOrchestrator {
  translate: (input: TranslationInput) => Promise<TranslationOutput | null>
  detect: (text: string) => Promise<LanguageDetectionResult>
  cancel: () => void
  setAdapter: (adapter: TranslationProvider) => void
  getAdapter: () => TranslationProvider | null
}

export function createTranslationOrchestrator(): TranslationOrchestrator {
  let adapter: TranslationProvider | null = null
  let sequence = 0
  let currentController: AbortController | null = null

  function cancel(): void {
    if (currentController) {
      currentController.abort()
      currentController = null
    }
  }

  async function translate(input: TranslationInput): Promise<TranslationOutput | null> {
    if (!adapter) {
      throw new AppError(
        ErrorCategory.InternalAppError,
        'no active provider adapter — call setAdapter before translate',
      )
    }

    cancel()

    const thisSequence = ++sequence
    const controller = new AbortController()
    currentController = controller

    try {
      const result = await adapter.translateText(input)

      if (thisSequence !== sequence || controller.signal.aborted) {
        return null
      }

      return result
    } catch (err) {
      if (thisSequence !== sequence || controller.signal.aborted) {
        return null
      }

      if (err instanceof Error && err.name === 'AbortError') {
        return null
      }

      throw err
    } finally {
      if (currentController === controller) {
        currentController = null
      }
    }
  }

  async function detect(text: string): Promise<LanguageDetectionResult> {
    if (!adapter) {
      throw new AppError(
        ErrorCategory.InternalAppError,
        'no active provider adapter — call setAdapter before detect',
      )
    }

    return adapter.detectLanguage(text)
  }

  function setAdapter(newAdapter: TranslationProvider): void {
    cancel()
    adapter = newAdapter
  }

  function getAdapter(): TranslationProvider | null {
    return adapter
  }

  return {
    translate,
    detect,
    cancel,
    setAdapter,
    getAdapter,
  }
}
