<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProvidersStore } from '@app/stores/providers'
import { useClipboard, onKeyStroke } from '@vueuse/core'

const providersStore = useProvidersStore()

const filePath = ref<string | null>(null)
const fileName = ref<string>('')
const outputPath = ref<string | null>(null)
const translating = ref<boolean>(false)
const error = ref<string | null>(null)
const supported = ref<boolean>(false)
const statusMessage = ref<string>('Checking provider capability...')

const { copy: copyPath } = useClipboard()

async function checkDocumentSupport() {
  try {
    const api = (window as unknown as {
      api: {
        documents: {
          status: () => Promise<{ supported: boolean, message?: string }>
        }
      }
    }).api
    const status = await api.documents.status()
    supported.value = status.supported
    statusMessage.value = status.message ?? (status.supported
      ? 'Document translation available'
      : 'Document translation not supported by the active provider')
  } catch {
    supported.value = false
    statusMessage.value = 'Unable to check document support'
  }
}

async function pickFile() {
  try {
    const api = (window as unknown as {
      api: {
        documents: {
          pick: () => Promise<{ filePath: string } | null>
        }
      }
    }).api
    const result = await api.documents.pick()

    if (result) {
      filePath.value = result.filePath
      fileName.value = result.filePath.split('/').pop() ?? result.filePath
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
    const api = (window as unknown as {
      api: {
        documents: {
          translate: (input: {
            filePath: string
            sourceLanguage: { mode: 'auto' }
            targetLanguage: string
          }) => Promise<{ outputPath: string } | null>
        }
      }
    }).api
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
    <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/"
            class="text-sm text-primary-600 dark:text-primary-400"
          >
            ← Translate
          </NuxtLink>
          <h1 class="text-lg font-semibold">
            Documents
          </h1>
        </div>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <!-- Capability status -->
        <div
          :class="[
            'text-sm px-4 py-2 rounded-lg',
            supported
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
          ]"
        >
          {{ statusMessage }}
        </div>

        <!-- Drop zone / file picker -->
        <div
          class="w-full max-w-md border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
          :class="supported
            ? 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
            : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'"
          @click="supported ? pickFile() : undefined"
        >
          <UIcon
            name="i-fluent-document-arrow-up-24-regular"
            class="text-3xl text-gray-400 mb-3"
          />
          <p
            v-if="!fileName"
            class="text-gray-500 dark:text-gray-400"
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
          class="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg"
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
          class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg max-w-md"
        >
          {{ error }}
        </div>
      </div>
    </div>
  </UApp>
</template>
