import {
  useDebounceFn, type PromisifyFn,
} from '@vueuse/core'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useSelectionPersistence } from '@app/composables/useSelectionPersistence'
import {
  reconcileSource,
  reconcileTarget,
} from '@app/composables/useSelectionReconcile'

type DebouncedTranslate = PromisifyFn<() => Promise<void>> & { cancel: () => void }

export function useTranslation() {
  const api = useApi()
  const translationStore = useTranslationStore()
  const providersStore = useProvidersStore()
  const settingsStore = useSettingsStore()
  const handleError = useHandleError()
  const {
    persist: persistSelection, restore: restoreSelection,
  } = useSelectionPersistence()

  async function executeTranslate(): Promise<void> {
    if (!providersStore.activeProviderId) {
      return
    }

    const text: string = translationStore.sourceText.trim()

    if (text.length === 0) {
      translationStore.translatedText = ''
      translationStore.error = null

      return
    }

    translationStore.loading = true
    translationStore.error = null

    try {
      const result = await api.translation.translate({
        text: translationStore.sourceText,
        source: providersStore.sourceSelection,
        targetLanguage: providersStore.targetLanguage ?? 'en',
      })

      if (result) {
        translationStore.translatedText = result.translatedText
        translationStore.detectedSourceLanguage = result.detectedSourceLanguage ?? null

        recordHistoryEntry(result.translatedText, result.detectedSourceLanguage ?? null)
      }
    } catch (err: unknown) {
      translationStore.error = err instanceof Error ? err.message : String(err)
    } finally {
      translationStore.loading = false
    }
  }

  function recordHistoryEntry(translatedText: string, detectedSource: string | null): void {
    const sourceLanguageCode: string = detectedSource ??
      (providersStore.sourceSelection.mode === 'explicit'
        ? providersStore.sourceSelection.code
        : 'auto')

    void api.history
      .add({
        sourceText: translationStore.sourceText,
        translatedText,
        sourceLanguageCode,
        targetLanguageCode: providersStore.targetLanguage ?? 'en',
        provider: providersStore.activeProviderId ?? 'unknown',
      })
      .catch((err: unknown): void => handleError(err))
  }

  const scheduleTranslate: DebouncedTranslate = useDebounceFn(
    executeTranslate,
    settingsStore.app.debounceMs,
  ) as DebouncedTranslate

  function cancelTranslation(): void {
    if (typeof scheduleTranslate.cancel === 'function') {
      scheduleTranslate.cancel()
    }

    try {
      void api.translation.cancel()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  function clearInput(): void {
    translationStore.sourceText = ''
    translationStore.translatedText = ''
    translationStore.detectedSourceLanguage = null
    translationStore.error = null
    cancelTranslation()
  }

  async function switchProvider(providerId: string): Promise<void> {
    providersStore.loading = true
    providersStore.error = null

    const previousTarget: string | null = providersStore.targetLanguage
    const previousSource = providersStore.sourceSelection

    try {
      const result = await api.providers.switch({ providerId })

      providersStore.activeProviderId = providerId
      providersStore.languages = result.languages
      providersStore.capabilities = result.capabilities
      providersStore.sourceSelection = reconcileSource(
        previousSource,
        result.selection.source,
        result.languages,
      )
      providersStore.targetLanguage = reconcileTarget(
        previousTarget,
        result.selection.target,
        result.languages,
      )

      if (result.error) {
        providersStore.error = result.error
      }

      persistSelection()

      if (translationStore.sourceText.trim().length > 0) {
        void scheduleTranslate()
      }
    } catch (err: unknown) {
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
    persistSelection,
    restoreSelection,
  }
}
