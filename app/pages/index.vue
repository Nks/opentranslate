<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useTranslation } from '@app/composables/useTranslation'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

interface QuickTranslateBridge {
  api?: { quickTranslate: { onText: (callback: (text: string) => void) => void } }
}

const api = useApi()
const translationStore = useTranslationStore()
const providersStore = useProvidersStore()
const {
  scheduleTranslate,
  clearInput,
  switchProvider,
  persistSelection,
  restoreSelection,
} = useTranslation()
const handleError = useHandleError()

async function loadProviders(): Promise<void> {
  try {
    const descriptors = await api.providers.list()
    providersStore.descriptors = descriptors as typeof providersStore.descriptors
  } catch (err: unknown) {
    handleError(err)
  }
}

function registerQuickTranslateListener(): void {
  const bridge = window as unknown as QuickTranslateBridge

  if (!bridge.api?.quickTranslate?.onText) {
    return
  }
  bridge.api.quickTranslate.onText((text: string): void => {
    translationStore.sourceText = text
    scheduleTranslate()
  })
}

onMounted(async (): Promise<void> => {
  await loadProviders()
  await restoreSelection()
  registerQuickTranslateListener()
})

function onSourceInput(value: string): void {
  translationStore.sourceText = value
  scheduleTranslate()
}

function onSourceLanguageChange(code: string | null): void {
  providersStore.sourceSelection = code === null
    ? { mode: 'auto' }
    : { mode: 'explicit', code }

  persistSelection()
  scheduleTranslate()
}

function onTargetLanguageChange(code: string | null): void {
  providersStore.targetLanguage = code
  persistSelection()
  scheduleTranslate()
}

const sourceCode = computed<string | null>((): string | null =>
  providersStore.sourceSelection.mode === 'explicit'
    ? providersStore.sourceSelection.code
    : null,
)

function swapLanguages(): void {
  if (providersStore.sourceSelection.mode !== 'explicit') {
    return
  }

  const currentSource: string = providersStore.sourceSelection.code
  const currentTarget: string | null = providersStore.targetLanguage

  if (currentTarget) {
    providersStore.sourceSelection = { mode: 'explicit', code: currentTarget }
  }

  if (currentSource) {
    providersStore.targetLanguage = currentSource
  }

  if (translationStore.translatedText) {
    translationStore.sourceText = translationStore.translatedText
    translationStore.translatedText = ''
  }

  persistSelection()
  scheduleTranslate()
}

const navItems: NavigationMenuItem[] = [
  { label: 'History', icon: 'i-fluent-history-24-regular', to: '/history' },
  { label: 'Documents', icon: 'i-fluent-document-24-regular', to: '/documents' },
  { label: 'Settings', icon: 'i-fluent-settings-24-regular', to: '/settings' },
]
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <TopBar
        :providers="providersStore.descriptors"
        :active-provider-id="providersStore.activeProviderId"
        :source-languages="providersStore.sourceLanguages"
        :source-code
        :target-languages="providersStore.targetLanguages"
        :target-language="providersStore.targetLanguage"
        :swap-disabled="providersStore.sourceSelection.mode === 'auto'"
        :nav-items
        @switch="switchProvider"
        @source-change="onSourceLanguageChange"
        @target-change="onTargetLanguageChange"
        @swap="swapLanguages"
      />

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

      <ProviderErrorBanner
        v-if="providersStore.error"
        :message="providersStore.error"
        @dismiss="providersStore.error = null"
      />

      <StatusBar
        :loading="translationStore.loading || providersStore.loading"
        :error="translationStore.error"
        @retry="scheduleTranslate"
      />
    </div>
  </UApp>
</template>
