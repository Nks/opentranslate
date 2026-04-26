import { ref } from 'vue'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useSettingsStore } from '@app/stores/settings'
import { useProvidersStore } from '@app/stores/providers'

const SAVE_MESSAGE_TTL_MS: number = 2_000

export function useSettingsPage() {
  const api = useApi()
  const settingsStore = useSettingsStore()
  const providersStore = useProvidersStore()
  const handleError = useHandleError()

  const saving = ref<boolean>(false)
  const saveMessage = ref<string | null>(null)
  const platform = ref<NodeJS.Platform | 'unknown'>('unknown')
  const providerSettings = ref<Record<string, Record<string, unknown>>>({})
  const testingProvider = ref<string | null>(null)
  const providerTestResult = ref<Record<string, string>>({})

  async function loadSettings(): Promise<void> {
    try {
      const result = await api.settings.get()
      settingsStore.app = result.app

      for (const [id, value] of Object.entries(result.providers)) {
        providerSettings.value[id] = value as Record<string, unknown>
      }
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function loadProviders(): Promise<void> {
    try {
      const descriptors = await api.providers.list()
      providersStore.descriptors = descriptors as typeof providersStore.descriptors
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function loadPlatform(): Promise<void> {
    try {
      platform.value = await api.getPlatform()
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function saveSettings(patch: Record<string, unknown>): Promise<void> {
    saving.value = true
    saveMessage.value = null

    try {
      await api.settings.update(patch)
      saveMessage.value = 'Saved'
      setTimeout((): void => {
        saveMessage.value = null
      }, SAVE_MESSAGE_TTL_MS)
    } catch (err: unknown) {
      saveMessage.value = `Error: ${err instanceof Error ? err.message : String(err)}`
    } finally {
      saving.value = false
    }
  }

  function onAppFieldChange(key: string, value: unknown): void {
    const updated = {
      ...settingsStore.app,
      [key]: value,
    }
    settingsStore.app = updated
    void saveSettings({ app: updated })
  }

  async function onProviderFieldChange(
    providerId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const current: Record<string, unknown> = providerSettings.value[providerId] ?? {}
    const updated: Record<string, unknown> = {
      ...current,
      [key]: value,
    }
    providerSettings.value[providerId] = updated
    await saveSettings({ providers: { [providerId]: updated } })

    if (providersStore.activeProviderId === providerId) {
      try {
        await api.providers.switch({ providerId })
      } catch (err: unknown) {
        handleError(err)
      }
    }
  }

  async function onSecretChange(
    providerId: string,
    _key: string,
    value: string,
  ): Promise<void> {
    try {
      await api.secrets.set({
        providerId,
        secret: value,
      })
    } catch (err: unknown) {
      handleError(err)
    }
  }

  async function testProviderConnection(providerId: string): Promise<void> {
    testingProvider.value = providerId
    providerTestResult.value[providerId] = ''

    try {
      const result = await api.providers.switch({ providerId })
      providerTestResult.value[providerId] = result.error ??
        `OK — ${result.languages.length} languages loaded`
    } catch (err: unknown) {
      providerTestResult.value[providerId] = err instanceof Error ? err.message : String(err)
    } finally {
      testingProvider.value = null
    }
  }

  return {
    saving,
    saveMessage,
    platform,
    providerSettings,
    testingProvider,
    providerTestResult,
    loadSettings,
    loadProviders,
    loadPlatform,
    saveSettings,
    onAppFieldChange,
    onProviderFieldChange,
    onSecretChange,
    testProviderConnection,
  }
}
