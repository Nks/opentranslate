<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useClipboard, onKeyStroke } from '@vueuse/core'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

const sourceText = ref<string>('')
const translatedText = ref<string>('')
const detectedLanguage = ref<string | null>(null)
const targetLanguage = ref<string>('')
const provider = ref<string>('')
const loading = ref<boolean>(true)
const error = ref<string | null>(null)

const { copy: copyText } = useClipboard()
const handleError = useHandleError()

async function copyTranslation() {
  await copyText(translatedText.value)
}

function openInFull() {
  try {
    const api = useApi()
    void api.quickTranslate.openFull()
  } catch (err) {
    handleError(err)
  }
}

function closeOverlay() {
  try {
    const api = useApi()
    void api.quickTranslate.close()
  } catch (err) {
    handleError(err)
    window.close()
  }
}

onKeyStroke('Escape', closeOverlay)

onMounted(() => {
  loading.value = false
})
</script>

<template>
  <div class="h-screen flex flex-col bg-default rounded-lg shadow-xl overflow-hidden select-none">
    <!-- Header (draggable) -->
    <div
      class="flex items-center justify-between px-4 py-2 bg-elevated border-b border-default"
      style="-webkit-app-region: drag"
    >
      <span class="text-xs text-muted">
        <template v-if="detectedLanguage">{{ detectedLanguage }}</template>
        <template v-else>Auto</template>
        → {{ targetLanguage }}
      </span>
      <span class="text-xs text-dimmed">{{ provider }}</span>
    </div>

    <!-- Content -->
    <div class="flex-1 p-4 overflow-y-auto">
      <div
        v-if="loading"
        class="flex items-center justify-center h-full"
      >
        <UIcon
          name="i-fluent-arrow-sync-24-regular"
          class="animate-spin text-primary text-xl"
        />
      </div>
      <div
        v-else-if="error"
        class="text-error text-sm"
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
      class="flex items-center justify-between px-4 py-2 border-t border-default"
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
