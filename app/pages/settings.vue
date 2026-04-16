<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TabsItem } from '@nuxt/ui'
import { useSettingsStore } from '@app/stores/settings'
import { useProvidersStore } from '@app/stores/providers'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

const settingsStore = useSettingsStore()
const providersStore = useProvidersStore()
const handleError = useHandleError()

const activeTab = ref<string>('general')
const saving = ref<boolean>(false)
const saveMessage = ref<string | null>(null)

const providerSettings = ref<Record<string, Record<string, unknown>>>({})
const testingProvider = ref<string | null>(null)
const providerTestResult = ref<Record<string, string>>({})

interface SelectItem {
  label: string
  value: string
}

const themeItems: SelectItem[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

const retentionItems: SelectItem[] = [
  { label: 'Keep forever', value: 'forever' },
  { label: 'Last 30 days', value: 'last-30-days' },
  { label: 'Last 100 entries', value: 'last-100-entries' },
]

async function testProviderConnection(providerId: string) {
  testingProvider.value = providerId
  providerTestResult.value[providerId] = ''

  try {
    const api = useApi()
    const result = await api.providers.switch({ providerId })

    if (result.error) {
      providerTestResult.value[providerId] = result.error
    } else {
      providerTestResult.value[providerId] = `OK — ${result.languages.length} languages loaded`
    }
  } catch (err) {
    providerTestResult.value[providerId] = err instanceof Error ? err.message : String(err)
  } finally {
    testingProvider.value = null
  }
}

async function loadSettings() {
  try {
    const api = useApi()
    const result = await api.settings.get()
    settingsStore.app = result.app

    for (const [id, val] of Object.entries(result.providers)) {
      providerSettings.value[id] = val as Record<string, unknown>
    }
  } catch (err) {
    handleError(err)
  }
}

async function saveSettings(patch: Record<string, unknown>) {
  saving.value = true
  saveMessage.value = null

  try {
    const api = useApi()
    await api.settings.update(patch)
    saveMessage.value = 'Saved'
    setTimeout(() => {
      saveMessage.value = null
    }, 2000)
  } catch (err) {
    saveMessage.value = `Error: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    saving.value = false
  }
}

function onAppSettingChange(key: string, value: unknown) {
  const updated = { ...settingsStore.app, [key]: value }
  settingsStore.app = updated
  void saveSettings({ app: updated })
}

async function onProviderFieldChange(providerId: string, key: string, value: unknown) {
  const current = providerSettings.value[providerId] ?? {}
  const updated = { ...current, [key]: value }
  providerSettings.value[providerId] = updated
  await saveSettings({ providers: { [providerId]: updated } })

  if (providersStore.activeProviderId === providerId) {
    try {
      const api = useApi()
      await api.providers.switch({ providerId })
    } catch (err) {
      handleError(err)
    }
  }
}

async function onSecretChange(providerId: string, _key: string, value: string) {
  try {
    const api = useApi()
    await api.secrets.set({ providerId, secret: value })
  } catch (err) {
    handleError(err)
  }
}

async function loadProviders() {
  try {
    const api = useApi()
    const descriptors = await api.providers.list()
    providersStore.descriptors = descriptors as typeof providersStore.descriptors
  } catch (err) {
    handleError(err)
  }
}

onMounted(() => {
  void loadSettings()
  void loadProviders()
})

const tabs: TabsItem[] = [
  { label: 'General', value: 'general', icon: 'i-fluent-settings-24-regular' },
  { label: 'Providers', value: 'providers', icon: 'i-fluent-cloud-24-regular' },
  { label: 'Shortcuts', value: 'shortcuts', icon: 'i-fluent-keyboard-24-regular' },
  { label: 'Advanced', value: 'advanced', icon: 'i-fluent-wrench-24-regular' },
  { label: 'About', value: 'about', icon: 'i-fluent-info-24-regular' },
]
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
        <UButton
          to="/"
          variant="ghost"
          size="xs"
          icon="i-fluent-arrow-left-24-regular"
          label="Translate"
          aria-label="Back to translate"
        />
        <h1 class="text-lg font-semibold">
          Settings
        </h1>
        <span
          v-if="saveMessage"
          class="ml-auto text-xs"
          :class="saveMessage.startsWith('Error') ? 'text-error' : 'text-success'"
        >
          {{ saveMessage }}
        </span>
      </div>

      <div class="flex-1 flex">
        <!-- Tab sidebar -->
        <div class="w-48 border-r border-default p-2">
          <UTabs
            v-model="activeTab"
            orientation="vertical"
            :items="tabs"
            :content="false"
            variant="pill"
          />
        </div>

        <!-- Tab content -->
        <div class="flex-1 p-6 overflow-y-auto max-w-2xl">
          <!-- General -->
          <div v-if="activeTab === 'general'" class="space-y-6">
            <UFormField label="Theme">
              <USelect
                :model-value="settingsStore.app.theme"
                :items="themeItems"
                value-key="value"
                label-key="label"
                aria-label="Theme"
                @update:model-value="(val: string) => onAppSettingChange('theme', val)"
              />
            </UFormField>

            <UFormField label="Translation debounce (ms)">
              <UInput
                type="number"
                :model-value="String(settingsStore.app.debounceMs)"
                aria-label="Debounce milliseconds"
                @update:model-value="(val: string) => onAppSettingChange('debounceMs', Number(val))"
              />
            </UFormField>

            <UFormField label="Translation history">
              <USwitch
                :model-value="settingsStore.app.historyEnabled"
                @update:model-value="(val: boolean) => onAppSettingChange('historyEnabled', val)"
              />
            </UFormField>

            <UFormField label="History retention">
              <USelect
                :model-value="settingsStore.app.historyRetentionMode"
                :items="retentionItems"
                value-key="value"
                label-key="label"
                aria-label="History retention mode"
                @update:model-value="(val: string) => onAppSettingChange('historyRetentionMode', val)"
              />
            </UFormField>
          </div>

          <!-- Providers -->
          <div v-if="activeTab === 'providers'" class="space-y-8">
            <div
              v-for="descriptor in providersStore.descriptors"
              :key="descriptor.id"
            >
              <h2 class="text-base font-semibold mb-4">
                {{ descriptor.displayName }}
              </h2>
              <p class="text-sm text-muted mb-4">
                {{ descriptor.description }}
              </p>
              <ProviderSettingsForm
                :provider-id="descriptor.id"
                :settings-fields="descriptor.settingsFields"
                :secret-fields="descriptor.secretFields"
                :current-settings="(providerSettings[descriptor.id] ?? {}) as Record<string, unknown>"
                @update:field="(key: string, val: unknown) => onProviderFieldChange(descriptor.id, key, val)"
                @update:secret="(key: string, val: string) => onSecretChange(descriptor.id, key, val)"
              />
              <div class="mt-4">
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-fluent-plug-connected-24-regular"
                  :loading="testingProvider === descriptor.id"
                  :aria-label="`Test ${descriptor.displayName} connection`"
                  @click="testProviderConnection(descriptor.id)"
                >
                  Test Connection
                </UButton>
                <span
                  v-if="providerTestResult[descriptor.id]"
                  class="ml-3 text-sm"
                  :class="providerTestResult[descriptor.id]?.startsWith('OK') ? 'text-success' : 'text-error'"
                >
                  {{ providerTestResult[descriptor.id] }}
                </span>
              </div>
            </div>
            <p
              v-if="providersStore.descriptors.length === 0"
              class="text-dimmed"
            >
              No providers registered.
            </p>
          </div>

          <!-- Shortcuts -->
          <div v-if="activeTab === 'shortcuts'" class="space-y-6">
            <UFormField label="Quick translate shortcut">
              <UInput
                :model-value="settingsStore.app.shortcuts.quickTranslate"
                aria-label="Quick translate shortcut"
                @update:model-value="(val: string) => onAppSettingChange('shortcuts', { ...settingsStore.app.shortcuts, quickTranslate: val })"
              />
            </UFormField>

            <UFormField label="Enable quick translate">
              <USwitch
                :model-value="settingsStore.app.shortcuts.quickTranslateEnabled"
                @update:model-value="(val: boolean) => onAppSettingChange('shortcuts', { ...settingsStore.app.shortcuts, quickTranslateEnabled: val })"
              />
            </UFormField>
          </div>

          <!-- Advanced -->
          <div v-if="activeTab === 'advanced'" class="space-y-6">
            <UFormField label="Request timeout (ms)">
              <UInput
                type="number"
                :model-value="String(settingsStore.app.advanced.requestTimeoutMs)"
                aria-label="Request timeout"
                @update:model-value="(val: string) => onAppSettingChange('advanced', { ...settingsStore.app.advanced, requestTimeoutMs: Number(val) })"
              />
            </UFormField>

            <UFormField label="Allow self-signed TLS (LibreTranslate)">
              <USwitch
                :model-value="settingsStore.app.advanced.libreAllowSelfSignedTls"
                @update:model-value="(val: boolean) => onAppSettingChange('advanced', { ...settingsStore.app.advanced, libreAllowSelfSignedTls: val })"
              />
            </UFormField>

            <div class="pt-4 border-t border-default">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Reset all local data"
              >
                Reset Local Data
              </UButton>
              <p class="text-xs text-dimmed mt-1">
                Clears settings, history, and cached credentials.
              </p>
            </div>
          </div>

          <!-- About -->
          <div v-if="activeTab === 'about'" class="space-y-4">
            <h2 class="text-base font-semibold">
              OpenTranslate Desktop
            </h2>
            <p class="text-sm text-muted">
              MIT-licensed desktop translator with a DeepL-style workflow.
            </p>
            <p class="text-sm text-muted">
              Built with Electron, Nuxt 4, and Nuxt UI.
            </p>
            <p class="text-xs text-dimmed">
              License: MIT
            </p>
          </div>
        </div>
      </div>
    </div>
  </UApp>
</template>
