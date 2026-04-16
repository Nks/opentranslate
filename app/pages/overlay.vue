<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useClipboard } from '@vueuse/core'

const sourceText = ref<string>('')
const translatedText = ref<string>('')
const detectedLanguage = ref<string | null>(null)
const targetLanguage = ref<string>('')
const provider = ref<string>('')
const loading = ref<boolean>(true)
const error = ref<string | null>(null)

const { copy: copyText } = useClipboard()

async function copyTranslation() {
  await copyText(translatedText.value)
}

function openInFull() {
  try {
    const api = (window as unknown as {
      api: {
        quickTranslate: { openFull: () => Promise<void> }
      }
    }).api
    void api.quickTranslate.openFull()
  } catch {
    // fallback
  }
}

function closeOverlay() {
  try {
    const api = (window as unknown as {
      api: {
        quickTranslate: { close: () => Promise<void> }
      }
    }).api
    void api.quickTranslate.close()
  } catch {
    window.close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeOverlay()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)

  loading.value = false
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden select-none">
    <!-- Header (draggable) -->
    <div
      class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      style="-webkit-app-region: drag"
    >
      <span class="text-xs text-gray-500 dark:text-gray-400">
        <template v-if="detectedLanguage">{{ detectedLanguage }}</template>
        <template v-else>Auto</template>
        → {{ targetLanguage }}
      </span>
      <span class="text-xs text-gray-400">{{ provider }}</span>
    </div>

    <!-- Content -->
    <div class="flex-1 p-4 overflow-y-auto">
      <div
        v-if="loading"
        class="flex items-center justify-center h-full"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="animate-spin text-primary-500 text-xl"
        />
      </div>
      <div
        v-else-if="error"
        class="text-red-600 dark:text-red-400 text-sm"
      >
        {{ error }}
      </div>
      <p
        v-else
        class="text-sm leading-relaxed"
      >
        {{ translatedText }}
      </p>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700"
      style="-webkit-app-region: no-drag"
    >
      <UButton
        size="xs"
        variant="ghost"
        aria-label="Copy translation"
        :disabled="!translatedText"
        @click="copyTranslation"
      >
        Copy
      </UButton>
      <UButton
        size="xs"
        variant="ghost"
        aria-label="Open in full application"
        @click="openInFull"
      >
        Open Full
      </UButton>
      <UButton
        size="xs"
        variant="ghost"
        aria-label="Close overlay"
        @click="closeOverlay"
      >
        Close
      </UButton>
    </div>
  </div>
</template>
