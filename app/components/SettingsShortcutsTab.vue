<script setup lang="ts">
import { useHandleError } from '@app/composables/useHandleError'
import type { ShortcutsSettings } from '@shared/types/settings'

interface Props {
  shortcuts: ShortcutsSettings
  platform: NodeJS.Platform | 'unknown' | string
}

interface Emits {
  'update:shortcuts': [value: ShortcutsSettings]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleError = useHandleError()

function onQuickTranslateShortcutChange(value: string) {
  if (value.length === 0) {
    handleError(new Error('Shortcut cannot be empty. Record a new combo or keep the current one.'))

    return
  }
  emit('update:shortcuts', {
    ...props.shortcuts,
    quickTranslate: value,
  })
}

function onQuickTranslateEnabledChange(value: boolean) {
  emit('update:shortcuts', {
    ...props.shortcuts,
    quickTranslateEnabled: value,
  })
}

function onShortcutRecorderError(message: string) {
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
