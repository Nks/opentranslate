<script setup lang="ts">
import { useHandleError } from '@app/composables/useHandleError'
import type { ShortcutsSettings } from '@shared/types/settings'
import type { Platform } from '@shared/shortcuts/quick-translate'

interface Props {
  shortcuts: ShortcutsSettings
  platform: Platform | 'unknown'
}

interface Emits {
  'update:shortcuts': [value: ShortcutsSettings]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleError = useHandleError()

function onQuickTranslateShortcutChange(value: string): void {
  if (value.length === 0) {
    handleError(new Error('Shortcut cannot be empty. Record a new combo or keep the current one.'))

    return
  }
  emit('update:shortcuts', {
    ...props.shortcuts,
    quickTranslate: value,
  })
}

function onQuickTranslateEnabledChange(value: boolean): void {
  emit('update:shortcuts', {
    ...props.shortcuts,
    quickTranslateEnabled: value,
  })
}

function onShortcutRecorderError(message: string): void {
  handleError(new Error(message))
}
</script>

<template>
  <div class="space-y-6">
    <UFormField
      label="Quick translate shortcut"
      help="Click the field, then press the key combo you want. The chord pattern (same key pressed twice) is fixed."
    >
      <ShortcutRecorder
        :model-value="shortcuts.quickTranslate"
        :platform
        aria-label="Quick translate shortcut"
        @update:model-value="onQuickTranslateShortcutChange"
        @error="onShortcutRecorderError"
      />
    </UFormField>

    <UFormField label="Enable quick translate">
      <USwitch
        :model-value="shortcuts.quickTranslateEnabled"
        @update:model-value="onQuickTranslateEnabledChange"
      />
    </UFormField>
  </div>
</template>
