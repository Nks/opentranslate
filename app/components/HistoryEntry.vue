<script setup lang="ts">
import type { HistoryEntry } from '@shared/types/history'

interface Props {
  entry: HistoryEntry
}

interface Emits {
  reopen: [entry: HistoryEntry]
  delete: [id: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <UCard class="mb-2">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {{ props.entry.sourceLanguageCode }} → {{ props.entry.targetLanguageCode }}
          · {{ props.entry.provider }}
          · {{ formatDate(props.entry.createdAt) }}
        </p>
        <p class="text-sm font-medium truncate">
          {{ props.entry.sourceText }}
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
          {{ props.entry.translatedText }}
        </p>
      </div>
      <div class="flex gap-1 shrink-0">
        <UButton
          size="xs"
          variant="ghost"
          aria-label="Reopen in editor"
          @click="emit('reopen', props.entry)"
        >
          Open
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="red"
          aria-label="Delete entry"
          @click="emit('delete', props.entry.id)"
        >
          Delete
        </UButton>
      </div>
    </div>
  </UCard>
</template>
