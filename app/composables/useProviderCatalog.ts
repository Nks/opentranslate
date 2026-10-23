import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import {
  useProvidersStore, type RendererProviderSettings,
} from '@app/stores/providers'
import type { SettingsGetResponseShape } from '@electron/ipc/channels'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'

export function useProviderCatalog() {
  const api: ReturnType<typeof useApi> = useApi()
  const providersStore: ReturnType<typeof useProvidersStore> = useProvidersStore()
  const handleError: (err: unknown) => void = useHandleError()

  async function loadProviderCatalog(): Promise<void> {
    try {
      const [descriptors, settings]: [
        readonly ProviderDescriptorDto[],
        SettingsGetResponseShape,
      ] = await Promise.all([
        api.providers.list(),
        api.settings.get(),
      ])
      providersStore.descriptors = descriptors as typeof providersStore.descriptors

      const nextProviderSettings: Record<string, RendererProviderSettings> = {}

      for (const [id, slice] of Object.entries(settings.providers)) {
        nextProviderSettings[id] = (slice ?? {}) as RendererProviderSettings
      }

      providersStore.providerSettings = nextProviderSettings
    } catch (err: unknown) {
      handleError(err)
    }
  }

  return { loadProviderCatalog }
}
