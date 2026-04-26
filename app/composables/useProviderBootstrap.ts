import { useProvidersStore } from '@app/stores/providers'

export function useProviderBootstrap() {
  const providersStore = useProvidersStore()

  function maybeAutoSelectProvider(switchProvider: (id: string) => unknown): void {
    if (providersStore.activeProviderId !== null) {
      return
    }

    const [firstActive] = providersStore.activeDescriptors

    if (!firstActive) {
      return
    }

    switchProvider(firstActive.id)
  }

  return { maybeAutoSelectProvider }
}
