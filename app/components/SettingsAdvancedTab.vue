<script setup lang="ts">
import type { AdvancedSettings } from '@shared/types/settings'

interface Props {
  advanced: AdvancedSettings
}

interface Emits {
  (event: 'update:advanced', value: AdvancedSettings): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function onTimeoutChange(raw: string): void {
  emit('update:advanced', {
    ...props.advanced,
    requestTimeoutMs: Number(raw),
  })
}
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Request timeout (ms)">
      <UInput
        type="number"
        :model-value="String(advanced.requestTimeoutMs)"
        aria-label="Request timeout"
        @update:model-value="onTimeoutChange"
      />
    </UFormField>

    <div class="pt-4 border-t border-default">
      <UButton
        color="error"
        variant="ghost"
        size="sm"
        aria-label="Reset all local data"
      >
        Reset Local Data
      </UButton>
      <p class="text-xs text-dimmed mt-1">
        Clears settings, history, and cached credentials.
      </p>
    </div>
  </div>
</template>
