<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProvidersStore } from '@app/stores/providers'
import { useClipboard, onKeyStroke } from '@vueuse/core'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

const providersStore = useProvidersStore()

const filePath = ref<string | null>(null)
const fileName = ref<string>('')
const outputPath = ref<string | null>(null)
const translating = ref<boolean>(false)
const error = ref<string | null>(null)
const supported = ref<boolean>(false)
const statusMessage = ref<string>('Checking provider capability...')

const api = useApi()
const { copy: copyPath } = useClipboard()
const handleError = useHandleError()

/** Extract the filename portion from an absolute file path. */
function extractFileName(path: string): string {
  return path.split('/').pop() ?? path
}

async function checkDocumentSupport() {
  try {
    const status = await api.documents.status()
    supported.value = status.supported
    statusMessage.value = status.message ?? (status.supported
      ? 'Document translation available'
      : 'Document translation not supported by the active provider')
  } catch (err) {
    supported.value = false
    statusMessage.value = 'Unable to check document support'
    handleError(err)
  }
}

async function pickFile() {
  try {
    const result = await api.documents.pick()

    if (result) {
      filePath.value = result.filePath
      fileName.value = extractFileName(result.filePath)
      outputPath.value = null
      error.value = null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function translateDocument() {
  if (!filePath.value || !providersStore.targetLanguage) {
    return
  }

  translating.value = true
  error.value = null
  outputPath.value = null

  try {
    const result = await api.documents.translate({
      filePath: filePath.value,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: providersStore.targetLanguage,
    })

    if (result) {
      outputPath.value = result.outputPath
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    translating.value = false
  }
}

onMounted(() => {
  void checkDocumentSupport()
})

onKeyStroke('Escape', () => {
  error.value = null
})
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <div class="flex items-center justify-between px-4 py-3 border-b border-default">
        <div class="flex items-center gap-3">
          <UButton
            to="/"
            variant="ghost"
            size="xs"
            icon="i-fluent-arrow-left-24-regular"
            label="Translate"
            aria-label="Back to translate"
          />
          <h1 class="text-lg font-semibold">
            Documents
          </h1>
        </div>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <!-- Capability status -->
        <div
          :class="[
            'text-sm px-4 py-2 rounded-lg bg-elevated',
            supported
              ? 'text-success'
              : 'text-warning',
          ]"
        >
          {{ statusMessage }}
        </div>

        <!-- Drop zone / file picker -->
        <div
          class="w-full max-w-md border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
          :class="supported
            ? 'border-default hover:border-primary'
            : 'border-default opacity-50 cursor-not-allowed'"
          @click="supported ? pickFile() : undefined"
        >
          <UIcon
            name="i-fluent-arrow-upload-24-regular"
            class="text-3xl text-dimmed mb-3"
          />
          <p
            v-if="!fileName"
            class="text-muted"
          >
            Click to select a file or drag and drop
          </p>
          <p
            v-else
            class="text-sm font-medium"
          >
            {{ fileName }}
          </p>
        </div>

        <!-- Translate button -->
        <UButton
          v-if="filePath && supported"
          :loading="translating"
          :disabled="!providersStore.targetLanguage"
          aria-label="Translate document"
          @click="translateDocument"
        >
          Translate to {{ providersStore.targetLanguage ?? '...' }}
        </UButton>

        <!-- Output -->
        <div
          v-if="outputPath"
          class="text-sm text-success bg-elevated px-4 py-3 rounded-lg"
        >
          <p class="font-medium mb-1">
            Translation saved:
          </p>
          <p class="font-mono text-xs break-all">
            {{ outputPath }}
          </p>
          <UButton
            size="xs"
            variant="ghost"
            class="mt-2"
            aria-label="Copy output path"
            @click="copyPath(outputPath!)"
          >
            Copy path
          </UButton>
        </div>

        <!-- Error -->
        <div
          v-if="error"
          class="text-sm text-error bg-elevated px-4 py-3 rounded-lg max-w-md"
        >
          {{ error }}
        </div>
      </div>
    </div>
  </UApp>
</template>
