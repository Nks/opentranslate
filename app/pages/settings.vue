<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TabsItem } from '@nuxt/ui'
import { useSettingsStore } from '@app/stores/settings'
import { useProvidersStore } from '@app/stores/providers'
import { useSettingsPage } from '@app/composables/useSettingsPage'
import type { AdvancedSettings, ShortcutsSettings } from '@shared/types/settings'

const settingsStore = useSettingsStore()
const providersStore = useProvidersStore()

const {
  saveMessage,
  platform,
  providerSettings,
  testingProvider,
  providerTestResult,
  loadSettings,
  loadProviders,
  loadPlatform,
  onAppFieldChange,
  onProviderFieldChange,
  onSecretChange,
  testProviderConnection,
} = useSettingsPage()

const activeTab = ref<string>('general')

const tabs: TabsItem[] = [
  { label: 'General', value: 'general', icon: 'i-fluent-settings-24-regular' },
  { label: 'Providers', value: 'providers', icon: 'i-fluent-cloud-24-regular' },
  { label: 'Shortcuts', value: 'shortcuts', icon: 'i-fluent-keyboard-24-regular' },
  { label: 'Advanced', value: 'advanced', icon: 'i-fluent-wrench-24-regular' },
  { label: 'About', value: 'about', icon: 'i-fluent-info-24-regular' },
]

function onShortcutsChange(value: ShortcutsSettings): void {
  onAppFieldChange('shortcuts', value)
}

function onAdvancedChange(value: AdvancedSettings): void {
  onAppFieldChange('advanced', value)
}

onMounted((): void => {
  void loadSettings()
  void loadProviders()
  void loadPlatform()
})
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
        <div class="w-48 border-r border-default p-2">
          <UTabs
            v-model="activeTab"
            orientation="vertical"
            :items="tabs"
            :content="false"
            variant="pill"
          />
        </div>

        <div class="flex-1 p-6 overflow-y-auto max-w-2xl">
          <SettingsGeneralTab
            v-if="activeTab === 'general'"
            :app="settingsStore.app"
            @update:field="onAppFieldChange"
          />

          <SettingsProvidersTab
            v-if="activeTab === 'providers'"
            :descriptors="providersStore.descriptors"
            :provider-settings
            :testing-provider="testingProvider"
            :provider-test-result="providerTestResult"
            @update:field="onProviderFieldChange"
            @update:secret="onSecretChange"
            @test="testProviderConnection"
          />

          <SettingsShortcutsTab
            v-if="activeTab === 'shortcuts'"
            :shortcuts="settingsStore.app.shortcuts"
            :platform
            @update:shortcuts="onShortcutsChange"
          />

          <SettingsAdvancedTab
            v-if="activeTab === 'advanced'"
            :advanced="settingsStore.app.advanced"
            @update:advanced="onAdvancedChange"
          />

          <SettingsAboutTab v-if="activeTab === 'about'" />
        </div>
      </div>
    </div>
  </UApp>
</template>
