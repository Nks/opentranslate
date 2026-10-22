import {
  useDebounceFn, type PromisifyFn,
} from '@vueuse/core'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import type { Language } from '@shared/types/language'
import { TARGET_HISTORY_MAX } from '@shared/types/settings'
import { formatErrorMessage } from '@shared/errors/format'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useSelectionPersistence } from '@app/composables/useSelectionPersistence'
import {
  pickFallbackTarget,
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
      translationStore.errorDetail = null

      return
    }

    translationStore.loading = true
    translationStore.error = null
    translationStore.errorDetail = null

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
        maybeAutoSwitchTarget(result.detectedSourceLanguage ?? null)
      }
    } catch (err: unknown) {
      const formatted = formatErrorMessage(err)
      translationStore.error = formatted.short
      translationStore.errorDetail = formatted.detail
    } finally {
      translationStore.loading = false
    }
  }

  function maybeAutoSwitchTarget(detectedSource: string | null): void {
    if (detectedSource === null) {
      return
    }

    if (providersStore.sourceSelection.mode !== 'auto') {
      return
    }

    const currentTarget: string | null = providersStore.targetLanguage

    if (currentTarget === null) {
      return
    }

    if (detectedSource !== currentTarget) {
      return
    }

    const candidate: string | null = pickFallbackTarget(
      settingsStore.app.targetHistory,
      detectedSource,
      currentTarget,
    )

    if (candidate === null) {
      return
    }

    providersStore.targetLanguage = candidate
    persistSelection()
    void scheduleTranslate()
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
    translationStore.errorDetail = null
    cancelTranslation()
  }

  async function pushTargetHistory(code: string | null): Promise<void> {
    if (code === null || code.length === 0) {
      return
    }

    const previous: readonly string[] = settingsStore.app.targetHistory
    const filtered: string[] = previous.filter(
      (entry: string): boolean => entry !== code,
    )
    const next: string[] = [code, ...filtered].slice(0, TARGET_HISTORY_MAX)

    settingsStore.app.targetHistory = next

    try {
      await api.settings.update({ app: { targetHistory: next } })
    } catch (err: unknown) {
      handleError(err)
    }
  }

  function pickFirstSupportedTarget(
    reconciledTarget: string | null,
    languages: Language[],
  ): string | null {
    if (reconciledTarget !== null) {
      return reconciledTarget
    }

    const firstCapable = languages.find((lang: Language): boolean => lang.supportsTarget)

    return firstCapable?.code ?? null
  }

  async function switchProvider(providerId: string): Promise<void> {
    if (typeof scheduleTranslate.cancel === 'function') {
      scheduleTranslate.cancel()
    }

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

      const reconciledTarget = reconcileTarget(
        previousTarget,
        result.selection.target,
        result.languages,
      )
      providersStore.targetLanguage = pickFirstSupportedTarget(reconciledTarget, result.languages)

      if (result.error) {
        providersStore.error = result.error
      }

      persistSelection()

      const canSchedule = providersStore.canTranslate
      const hasText = translationStore.sourceText.trim().length > 0

      if (canSchedule && hasText) {
        void scheduleTranslate()
      }
    } catch (err: unknown) {
      const formatted = formatErrorMessage(err)
      providersStore.capabilities = null
      providersStore.languages = []
      providersStore.error = formatted.short
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
    pushTargetHistory,
  }
}
