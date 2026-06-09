<script setup lang="ts">
import type { AppSettings } from '@shared/types/settings'

interface SelectItem {
  label: string
  value: string
}

interface Props {
  app: AppSettings
}

interface Emits {
  (event: 'update:field', key: string, value: unknown): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const themeItems: SelectItem[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

const retentionItems: SelectItem[] = [
  { label: 'Keep forever', value: 'forever' },
  { label: 'Last 30 days', value: 'last-30-days' },
  { label: 'Last 100 entries', value: 'last-100-entries' },
]

function emitUpdate(key: string, value: unknown): void {
  emit('update:field', key, value)
}
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Theme">
      <USelect
        :model-value="app.theme"
        :items="themeItems"
        value-key="value"
        label-key="label"
        aria-label="Theme"
        @update:model-value="(val: string) => emitUpdate('theme', val)"
      />
    </UFormField>

    <UFormField label="Translation debounce (ms)">
      <UInput
        type="number"
        :model-value="String(app.debounceMs)"
        aria-label="Debounce milliseconds"
        @update:model-value="(val: string) => emitUpdate('debounceMs', Number(val))"
      />
    </UFormField>

    <UFormField label="Translation history">
      <USwitch
        :model-value="app.historyEnabled"
        @update:model-value="(val: boolean) => emitUpdate('historyEnabled', val)"
      />
    </UFormField>

    <UFormField label="History retention">
      <USelect
        :model-value="app.historyRetentionMode"
        :items="retentionItems"
        value-key="value"
        label-key="label"
        aria-label="History retention mode"
        @update:model-value="(val: string) => emitUpdate('historyRetentionMode', val)"
      />
    </UFormField>
  </div>
</template>
