<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useTranslation } from '@app/composables/useTranslation'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

const translationStore = useTranslationStore()
const providersStore = useProvidersStore()
const {
  scheduleTranslate,
  clearInput,
  switchProvider,
} = useTranslation()
const handleError = useHandleError()

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
  void loadProviders()
})

function onSourceInput(value: string) {
  translationStore.sourceText = value
  scheduleTranslate()
}

function onSourceLanguageChange(code: string | null) {
  if (code === null) {
    providersStore.sourceSelection = { mode: 'auto' }
  } else {
    providersStore.sourceSelection = { mode: 'explicit', code }
  }

  scheduleTranslate()
}

function onTargetLanguageChange(code: string | null) {
  providersStore.targetLanguage = code
  scheduleTranslate()
}

const sourceCode = computed<string | null>(() =>
  providersStore.sourceSelection.mode === 'explicit'
    ? providersStore.sourceSelection.code
    : null,
)

const navItems: NavigationMenuItem[] = [
  {
    label: 'History',
    icon: 'i-fluent-history-24-regular',
    to: '/history',
  },
  {
    label: 'Documents',
    icon: 'i-fluent-document-24-regular',
    to: '/documents',
  },
  {
    label: 'Settings',
    icon: 'i-fluent-settings-24-regular',
    to: '/settings',
  },
]
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <!-- Top Bar -->
      <div class="flex items-center gap-4 px-4 py-3 border-b border-default">
        <ProviderSelector
          :providers="providersStore.descriptors"
          :active-id="providersStore.activeProviderId"
          @switch="switchProvider"
        />
        <LanguageSelector
          :languages="providersStore.sourceLanguages"
          :model-value="sourceCode"
          label="Source language"
          :auto-detect-option="true"
          @update:model-value="onSourceLanguageChange"
        />
        <UButton
          size="xs"
          variant="ghost"
          icon="i-fluent-arrow-swap-24-regular"
          aria-label="Swap languages"
          :disabled="providersStore.sourceSelection.mode === 'auto'"
        />
        <LanguageSelector
          :languages="providersStore.targetLanguages"
          :model-value="providersStore.targetLanguage"
          label="Target language"
          @update:model-value="onTargetLanguageChange"
        />
        <div class="ml-auto flex items-center gap-1">
          <UNavigationMenu
            :items="navItems"
            variant="pill"
          />
          <UColorModeButton />
        </div>
      </div>

      <!-- Two-pane translation area -->
      <div class="flex-1 grid grid-cols-2 gap-0 divide-x divide-default">
        <div class="p-4">
          <TranslationInput
            :model-value="translationStore.sourceText"
            @update:model-value="onSourceInput"
            @clear="clearInput"
          />
        </div>
        <div class="p-4">
          <TranslationOutput
            :text="translationStore.translatedText"
            :provider="providersStore.activeProviderId"
            :loading="translationStore.loading"
            @copy="() => {}"
          />
        </div>
      </div>

      <!-- Provider error banner -->
      <div
        v-if="providersStore.error"
        class="px-4 py-3 text-sm bg-elevated border-b border-default"
      >
        <div class="flex items-start gap-2">
          <UIcon
            name="i-fluent-warning-24-regular"
            class="shrink-0 text-error mt-0.5"
          />
          <pre class="flex-1 text-error whitespace-pre-wrap wrap-break-word font-mono text-xs">{{ providersStore.error }}</pre>
          <UButton
            size="xs"
            variant="ghost"
            aria-label="Dismiss error"
            @click="providersStore.error = null"
          >
            Dismiss
          </UButton>
        </div>
      </div>

      <!-- Status Bar -->
      <StatusBar
        :loading="translationStore.loading || providersStore.loading"
        :error="translationStore.error"
        @retry="scheduleTranslate"
      />
    </div>
  </UApp>
</template>
