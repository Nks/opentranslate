import { useProviderBootstrap } from '@app/composables/useProviderBootstrap'
import { useProviderCatalog } from '@app/composables/useProviderCatalog'
import { useSelectionPersistence } from '@app/composables/useSelectionPersistence'

export function useProviderSession() {
  const { loadProviderCatalog }: ReturnType<typeof useProviderCatalog> = useProviderCatalog()
  const { restore: restoreSelection }: ReturnType<typeof useSelectionPersistence> =
    useSelectionPersistence()
  const { ensureActiveProviderHydrated }: ReturnType<typeof useProviderBootstrap> =
    useProviderBootstrap()

  async function hydrateProviderSession(
    switchProvider: (providerId: string) => Promise<void>,
  ): Promise<void> {
    await loadProviderCatalog()
    await restoreSelection()

    let switching: Promise<void> = Promise.resolve()

    ensureActiveProviderHydrated((providerId: string): void => {
      switching = switchProvider(providerId)
    })
    await switching
  }

  return { hydrateProviderSession }
}
