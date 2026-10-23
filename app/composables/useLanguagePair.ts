import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useSelectionPersistence } from '@app/composables/useSelectionPersistence'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import {
  applySourceChange,
  applyTargetChange,
  type LanguagePair,
} from '@shared/translation/language-pair'
import { TARGET_HISTORY_MAX } from '@shared/types/settings'

export function useLanguagePair() {
  const api: ReturnType<typeof useApi> = useApi()
  const providersStore: ReturnType<typeof useProvidersStore> = useProvidersStore()
  const settingsStore: ReturnType<typeof useSettingsStore> = useSettingsStore()
  const handleError: (err: unknown) => void = useHandleError()
  const { persist: persistSelection } = useSelectionPersistence()

  function currentPair(): LanguagePair {
    return {
      source: providersStore.sourceSelection,
      target: providersStore.targetLanguage,
    }
  }

  function applyPair(next: LanguagePair): void {
    providersStore.sourceSelection = next.source
    providersStore.targetLanguage = next.target
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

  function changeSource(code: string | null): void {
    applyPair(applySourceChange(currentPair(), code))
    persistSelection()
  }

  async function changeTarget(code: string | null): Promise<void> {
    const next: LanguagePair = applyTargetChange(currentPair(), code)
    applyPair(next)

    await pushTargetHistory(next.target)
    persistSelection()
  }

  return {
    changeSource,
    changeTarget,
    pushTargetHistory,
  }
}
