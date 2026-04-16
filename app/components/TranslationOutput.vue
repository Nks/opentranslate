<script setup lang="ts">
interface Props {
  text: string
  provider: string | null
  loading: boolean
}

interface Emits {
  copy: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

async function copyToClipboard() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(props.text)
  }

  emit('copy')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="relative flex-1">
      <UTextarea
        :model-value="props.text"
        readonly
        aria-label="Translated text"
        :rows="10"
        class="flex-1"
      />
      <div
        v-if="props.loading"
        class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="animate-spin text-primary-500"
        />
      </div>
    </div>
    <div class="flex items-center justify-between mt-2 px-1 text-sm text-gray-500 dark:text-gray-400">
      <span v-if="props.provider">
        {{ props.provider }}
      </span>
      <UButton
        v-if="props.text.length > 0"
        size="xs"
        variant="ghost"
        aria-label="Copy translation"
        @click="copyToClipboard"
      >
        Copy
      </UButton>
    </div>
  </div>
</template>
