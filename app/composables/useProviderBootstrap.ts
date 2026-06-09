import { useProvidersStore } from '@app/stores/providers'

export function useProviderBootstrap() {
  const providersStore = useProvidersStore()

  function ensureActiveProviderHydrated(
    switchProvider: (id: string) => unknown,
  ): void {
    const restoredId: string | null = providersStore.activeProviderId
    const restoredIsKnown: boolean = restoredId !== null &&
      providersStore.descriptors.some((desc): boolean => desc.id === restoredId)

    if (restoredId !== null && restoredIsKnown) {
      switchProvider(restoredId)

      return
    }

    const [firstActive] = providersStore.activeDescriptors

    if (!firstActive) {
      return
    }

    switchProvider(firstActive.id)
  }

  return { ensureActiveProviderHydrated }
}
