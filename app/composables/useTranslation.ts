import {
  useDebounceFn, type PromisifyFn,
} from '@vueuse/core'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import { useApi } from './useApi'

/**
 * Composable encapsulating the core translation workflow.
 *
 * Provides debounced translate, cancel, clear, and provider switching.
 * All provider communication goes through `useApi()`.
 */
export function useTranslation() {
  const translationStore = useTranslationStore()
  const providersStore = useProvidersStore()
  const settingsStore = useSettingsStore()

  async function executeTranslate() {
    if (!providersStore.activeProviderId) {
      return
    }

    const text = translationStore.sourceText.trim()

    if (text.length === 0) {
      translationStore.translatedText = ''
      translationStore.error = null

      return
    }

    translationStore.loading = true
    translationStore.error = null

    try {
      const api = useApi()
      const result = await api.translation.translate({
        text: translationStore.sourceText,
        source: providersStore.sourceSelection,
        targetLanguage: providersStore.targetLanguage ?? 'en',
      })

      if (result) {
        translationStore.translatedText = result.translatedText
        translationStore.detectedSourceLanguage = result.detectedSourceLanguage ?? null

        // Add to history (fire-and-forget)
        void api.history.add({
          sourceText: translationStore.sourceText,
          translatedText: result.translatedText,
          sourceLanguageCode: result.detectedSourceLanguage ??
            (providersStore.sourceSelection.mode === 'explicit'
              ? providersStore.sourceSelection.code
              : 'auto'),
          targetLanguageCode: providersStore.targetLanguage ?? 'en',
          provider: providersStore.activeProviderId ?? 'unknown',
        }).catch(() => {
          // History recording failure must not break translation
        })
      }
    } catch (err) {
      translationStore.error = err instanceof Error ? err.message : String(err)
    } finally {
      translationStore.loading = false
    }
  }

  type DebouncedTranslate = PromisifyFn<typeof executeTranslate> & { cancel: () => void }

  const scheduleTranslate = useDebounceFn(
    executeTranslate,
    settingsStore.app.debounceMs,
  ) as DebouncedTranslate

  function cancelTranslation() {
    if (typeof scheduleTranslate.cancel === 'function') {
      scheduleTranslate.cancel()
    }

    try {
      const api = useApi()
      void api.translation.cancel()
    } catch {
      // api unavailable outside Electron
    }
  }

  function clearInput() {
    translationStore.sourceText = ''
    translationStore.translatedText = ''
    translationStore.detectedSourceLanguage = null
    translationStore.error = null
    cancelTranslation()
  }

  async function switchProvider(providerId: string) {
    providersStore.loading = true
    providersStore.error = null

    try {
      const api = useApi()
      const result = await api.providers.switch({ providerId })

      providersStore.activeProviderId = providerId
      providersStore.languages = result.languages
      providersStore.capabilities = result.capabilities
      providersStore.sourceSelection = result.selection.source
      providersStore.targetLanguage = result.selection.target

      if (result.error) {
        providersStore.error = result.error
      }

      if (translationStore.sourceText.trim().length > 0) {
        void scheduleTranslate()
      }
    } catch (err) {
      providersStore.error = err instanceof Error ? err.message : String(err)
    } finally {
      providersStore.loading = false
    }
  }

  return {
    scheduleTranslate,
    cancelTranslation,
    clearInput,
    switchProvider,
  }
}
