<script setup lang="ts">
import {
  computed, onMounted, ref,
} from 'vue'
import {
  onKeyStroke, useDropZone, type UseDropZoneReturn,
} from '@vueuse/core'
import { useProvidersStore } from '@app/stores/providers'
import { useTranslation } from '@app/composables/useTranslation'
import { useProviderSession } from '@app/composables/useProviderSession'
import { useLanguagePair } from '@app/composables/useLanguagePair'
import { useDocumentTranslation } from '@app/composables/useDocumentTranslation'
import type { Language } from '@shared/types/language'

const providersStore = useProvidersStore()
const { switchProvider }: ReturnType<typeof useTranslation> = useTranslation()
const { hydrateProviderSession }: ReturnType<typeof useProviderSession> = useProviderSession()
const {
  changeSource, changeTarget,
} = useLanguagePair()
const {
  checking,
  supported,
  formats,
  statusMessage,
  fileName,
  outputPath,
  translating,
  error,
  blockedReason,
  canTranslate,
  checkSupport,
  onProviderChanged,
  pickFile,
  dropFiles,
  translate,
  reveal,
  clearError,
} = useDocumentTranslation()

const pageRoot = ref<HTMLElement | null>(null)
const { isOverDropZone }: UseDropZoneReturn = useDropZone(pageRoot, {
  onDrop: (files: File[] | null): void => {
    void dropFiles(files)
  },
  preventDefaultForUnhandled: true,
})

const hasConfiguredProvider = computed<boolean>(
  (): boolean => providersStore.activeDescriptors.length > 0,
)

const targetLabel = computed<string | null>((): string | null => {
  const code: string | null = providersStore.targetLanguage

  if (code === null) {
    return null
  }

  const match: Language | undefined = providersStore.targetLanguages.find(
    (language: Language): boolean => language.code === code,
  )

  return match?.name ?? code
})

async function hydrateProviders(): Promise<void> {
  if (providersStore.descriptors.length > 0) {
    return
  }

  await hydrateProviderSession(switchProvider)
}

async function onProviderSwitch(providerId: string): Promise<void> {
  await switchProvider(providerId)
  await onProviderChanged()
}

function dismissProviderError(): void {
  providersStore.error = null
}

onMounted(async (): Promise<void> => {
  await hydrateProviders()
  await checkSupport()
})

onKeyStroke('Escape', (): void => {
  clearError()
})
</script>

<template>
  <UApp>
    <div
      ref="pageRoot"
      class="min-h-screen flex flex-col bg-default"
    >
      <DocumentsHeader
        :providers="providersStore.activeDescriptors"
        :active-provider-id="providersStore.activeProviderId"
        :source-languages="providersStore.sourceLanguages"
        :target-languages="providersStore.targetLanguages"
        :source-selection="providersStore.sourceSelection"
        :target-language="providersStore.targetLanguage"
        @switch="onProviderSwitch"
        @source-change="changeSource"
        @target-change="changeTarget"
      />

      <div
        v-if="hasConfiguredProvider"
        class="flex-1 flex flex-col items-center p-8 gap-6"
      >
        <DocumentCapability
          :checking
          :supported
          :message="statusMessage"
          :formats
        />
        <DocumentDropZone
          :disabled="!supported || translating"
          :dragging="isOverDropZone"
          :file-name
          @pick="pickFile"
        />
        <DocumentTranslateAction
          :can-translate
          :translating
          :file-name
          :target-label
          :blocked-reason
          @translate="translate"
        />
        <DocumentResult
          v-if="outputPath"
          :output-path
          @reveal="reveal"
        />
        <DocumentErrorPanel
          v-if="error"
          :error
          @dismiss="clearError"
        />
      </div>
      <EmptyProviderState v-else />

      <ProviderErrorBanner
        :error="providersStore.error"
        @dismiss="dismissProviderError"
      />
    </div>
  </UApp>
</template>
