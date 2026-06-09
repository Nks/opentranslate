<script setup lang="ts">
import type { HistoryEntry } from '@shared/types/history'

interface Props {
  entry: HistoryEntry
}

interface Emits {
  reopen: [entry: HistoryEntry]
  delete: [id: string]
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <UCard class="mb-2">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-muted mb-1">
          {{ entry.sourceLanguageCode }} → {{ entry.targetLanguageCode }}
          · {{ entry.provider }}
          · {{ formatDate(entry.createdAt) }}
        </p>
        <p class="text-sm font-medium truncate">
          {{ entry.sourceText }}
        </p>
        <p class="text-sm text-muted truncate mt-1">
          {{ entry.translatedText }}
        </p>
      </div>
      <div class="flex gap-1 shrink-0">
        <UButton
          size="xs"
          variant="ghost"
          aria-label="Reopen in editor"
          @click="emit('reopen', entry)"
        >
          Open
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="red"
          aria-label="Delete entry"
          @click="emit('delete', entry.id)"
        >
          Delete
        </UButton>
      </div>
    </div>
  </UCard>
</template>
