<script setup lang="ts">
import {
  computed, onMounted, ref,
} from 'vue'
import { useTranslationStore } from '@app/stores/translation'
import {
  useProvidersStore, type RendererProviderSettings,
} from '@app/stores/providers'
import { useTranslation } from '@app/composables/useTranslation'
import { useProviderBootstrap } from '@app/composables/useProviderBootstrap'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import {
  applySourceChange, applyTargetChange,
} from '@shared/translation/language-pair'
import type { WindowCloseResponsePayload } from '@electron/ipc/channels'
import ConfirmCloseDialog from '@app/components/ConfirmCloseDialog.vue'

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
const { ensureActiveProviderHydrated } = useProviderBootstrap()
const handleError = useHandleError()

const confirmCloseOpen = ref<boolean>(false)

async function loadProvidersAndSettings(): Promise<void> {
  try {
    const [descriptors, settings] = await Promise.all([
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

function registerCloseRequestListener(): void {
  api.window.onCloseRequest((): void => {
    confirmCloseOpen.value = true
  })
}

async function persistCloseBehavior(choice: 'hide' | 'quit'): Promise<void> {
  try {
    await api.settings.update({
      app: {
        closeBehavior: choice,
      },
    })
  } catch (err: unknown) {
    handleError(err)
  }
}

async function onCloseChoice(payload: WindowCloseResponsePayload): Promise<void> {
  confirmCloseOpen.value = false

  const shouldPersist: boolean = payload.remember && payload.choice !== 'cancel'

  if (shouldPersist) {
    await persistCloseBehavior(payload.choice as 'hide' | 'quit')
  }
  api.window.respondClose(payload)
}

onMounted(async (): Promise<void> => {
  await loadProvidersAndSettings()
  await restoreSelection()
  ensureActiveProviderHydrated((id: string): void => {
    void switchProvider(id)
  })
  registerQuickTranslateListener()
  registerCloseRequestListener()
})

const hasConfiguredProvider = computed<boolean>(
  (): boolean => providersStore.activeDescriptors.length > 0,
)

const inputDisabled = computed<boolean>(
  (): boolean => !providersStore.canTranslate,
)

function onSourceInput(value: string): void {
  translationStore.sourceText = value
  scheduleTranslate()
}

function onSourceLanguageChange(code: string | null): void {
  const next = applySourceChange(
    {
      source: providersStore.sourceSelection,
      target: providersStore.targetLanguage,
    },
    code,
  )
  providersStore.sourceSelection = next.source
  providersStore.targetLanguage = next.target

  persistSelection()
  scheduleTranslate()
}

function onTargetLanguageChange(code: string | null): void {
  const next = applyTargetChange(
    {
      source: providersStore.sourceSelection,
      target: providersStore.targetLanguage,
    },
    code,
  )
  providersStore.sourceSelection = next.source
  providersStore.targetLanguage = next.target

  persistSelection()
  scheduleTranslate()
}

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

function dismissProviderError(): void {
  providersStore.error = null
}

function noopCopy(): void {
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <TopBar
        :providers="providersStore.activeDescriptors"
        :active-provider-id="providersStore.activeProviderId"
        :source-languages="providersStore.sourceLanguages"
        :target-languages="providersStore.targetLanguages"
        :source-selection="providersStore.sourceSelection"
        :target-language="providersStore.targetLanguage"
        @switch="switchProvider"
        @source-change="onSourceLanguageChange"
        @target-change="onTargetLanguageChange"
        @swap="swapLanguages"
      />

      <div
        v-if="hasConfiguredProvider"
        class="flex-1 grid grid-cols-2 gap-0 divide-x divide-default"
      >
        <div class="p-4">
          <TranslationInput
            :model-value="translationStore.sourceText"
            :disabled="inputDisabled"
            @update:model-value="onSourceInput"
            @clear="clearInput"
          />
        </div>
        <div class="p-4">
          <TranslationOutput
            :text="translationStore.translatedText"
            :provider="providersStore.activeProviderId"
            :loading="translationStore.loading"
            :disabled="inputDisabled"
            @copy="noopCopy"
          />
        </div>
      </div>
      <EmptyProviderState v-else />

      <ProviderErrorBanner
        :error="providersStore.error"
        @dismiss="dismissProviderError"
      />

      <StatusBar
        :loading="translationStore.loading || providersStore.loading"
        :error="translationStore.error"
        :error-detail="translationStore.errorDetail"
        @retry="scheduleTranslate"
      />

      <ConfirmCloseDialog
        v-model="confirmCloseOpen"
        @choose="onCloseChoice"
      />
    </div>
  </UApp>
</template>
