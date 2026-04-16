import {
  useTranslationStore,
} from '@app/stores/translation'
import {
  useProvidersStore,
} from '@app/stores/providers'
import {
  useSettingsStore,
} from '@app/stores/settings'
import {
  useApi,
} from './useApi'

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function useTranslation() {
  const translationStore = useTranslationStore()
  const providersStore = useProvidersStore()
  const settingsStore = useSettingsStore()

  function scheduleTranslate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const text = translationStore.sourceText.trim()

    if (text.length === 0) {
      translationStore.translatedText = ''
      translationStore.error = null

      return
    }

    debounceTimer = setTimeout(async () => {
      if (!providersStore.activeProviderId) {
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
        }
      } catch (err) {
        translationStore.error = err instanceof Error ? err.message : String(err)
      } finally {
        translationStore.loading = false
      }
    }, settingsStore.app.debounceMs)
  }

  function cancelTranslation() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
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
      const result = await api.providers.switch({
        providerId,
      })

      providersStore.activeProviderId = providerId
      providersStore.languages = result.languages
      providersStore.capabilities = result.capabilities
      providersStore.sourceSelection = result.selection.source
      providersStore.targetLanguage = result.selection.target

      if (translationStore.sourceText.trim().length > 0) {
        scheduleTranslate()
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
