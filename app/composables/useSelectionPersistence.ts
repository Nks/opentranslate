import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsStore } from '@app/stores/settings'
import type { ActiveProviderSelection } from '@shared/types/settings'

export function useSelectionPersistence() {
  const api = useApi()
  const providersStore = useProvidersStore()
  const settingsStore = useSettingsStore()
  const handleError = useHandleError()

  function persist(): void {
    try {
      const snapshot: ActiveProviderSelection = providersStore.currentSelection

      void api.settings
        .update({ app: { activeProvider: snapshot } })
        .catch((err: unknown): void => handleError(err))
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function restore(): Promise<void> {
    try {
      const result = await api.settings.get()
      settingsStore.app = result.app
      providersStore.hydrateFromSelection(result.app.activeProvider)
    } catch (err: unknown) {
      handleError(err)
    }
  }

  return {
    persist,
    restore,
  }
}
