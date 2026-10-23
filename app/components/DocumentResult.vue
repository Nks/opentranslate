<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

interface Props {
  outputPath: string
}

interface Emits {
  reveal: []
}

defineProps<Props>()
defineEmits<Emits>()

const { copy: copyPath, copied } = useClipboard({ copiedDuring: 2000 })
</script>

<template>
  <div
    aria-label="Translated document"
    class="w-full max-w-xl text-sm bg-elevated px-4 py-3 rounded-lg flex flex-col gap-2"
  >
    <p class="font-medium text-success">
      Translation saved
    </p>
    <p class="font-mono text-xs break-all">
      {{ outputPath }}
    </p>
    <div class="flex gap-2">
      <UButton
        size="xs"
        variant="soft"
        icon="i-fluent-folder-open-24-regular"
        aria-label="Show in folder"
        @click="$emit('reveal')"
      >
        Show in folder
      </UButton>
      <UButton
        size="xs"
        variant="ghost"
        :icon="copied ? 'i-fluent-checkmark-24-regular' : 'i-fluent-copy-24-regular'"
        aria-label="Copy output path"
        @click="copyPath(outputPath)"
      >
        {{ copied ? 'Copied' : 'Copy path' }}
      </UButton>
    </div>
  </div>
</template>
