<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useTranslation } from '@app/composables/useTranslation'

const translationStore = useTranslationStore()
const providersStore = useProvidersStore()
const {
  scheduleTranslate,
  clearInput,
  switchProvider,
} = useTranslation()

async function loadProviders() {
  try {
    const api = (window as unknown as {
      api: { providers: { list: () => Promise<unknown[]> } }
    }).api
    const descriptors = await api.providers.list()
    providersStore.descriptors = descriptors as typeof providersStore.descriptors
  } catch {
    // outside Electron
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
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Top Bar -->
      <div class="flex items-center gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <ProviderSelector
          :providers="providersStore.descriptors"
          :active-id="providersStore.activeProviderId"
          @switch="switchProvider"
        />
        <LanguageSelector
          :languages="providersStore.sourceLanguages"
          :model-value="sourceCode"
          label="Source"
          :auto-detect-option="true"
          @update:model-value="onSourceLanguageChange"
        />
        <UButton
          size="xs"
          variant="ghost"
          aria-label="Swap languages"
          :disabled="providersStore.sourceSelection.mode === 'auto'"
        >
          ⇄
        </UButton>
        <LanguageSelector
          :languages="providersStore.targetLanguages"
          :model-value="providersStore.targetLanguage"
          label="Target"
          @update:model-value="onTargetLanguageChange"
        />
        <div class="ml-auto flex gap-2">
          <NuxtLink to="/history">
            <UButton
              size="xs"
              variant="ghost"
              aria-label="Translation history"
            >
              History
            </UButton>
          </NuxtLink>
          <NuxtLink to="/documents">
            <UButton
              size="xs"
              variant="ghost"
              aria-label="Document translation"
            >
              Documents
            </UButton>
          </NuxtLink>
        </div>
      </div>

      <!-- Two-pane translation area -->
      <div class="flex-1 grid grid-cols-2 gap-0 divide-x divide-gray-200 dark:divide-gray-700">
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

      <!-- Status Bar -->
      <StatusBar
        :loading="translationStore.loading"
        :error="translationStore.error"
        @retry="scheduleTranslate"
      />
    </div>
  </UApp>
</template>
