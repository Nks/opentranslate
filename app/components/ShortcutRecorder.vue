<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  formatShortcutForDisplay,
  parseQuickTranslateShortcut,
  type ShortcutModifier,
} from '@shared/shortcuts/quick-translate'

interface Props {
  /**
   * Host platform. `process.platform` isn't available in the renderer, so
   * the parent is responsible for passing the OS hint captured via
   * `api.getPlatform()`.
   */
  platform: NodeJS.Platform | 'darwin' | 'win32' | 'linux' | string
  ariaLabel?: string
}

interface Emits {
  (e: 'error', message: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const model = defineModel<string>({ required: true })

const recording = ref<boolean>(false)

const displayValue = computed<string>(() => {
  try {
    const parsed = parseQuickTranslateShortcut(model.value, props.platform)

    return formatShortcutForDisplay(parsed, props.platform)
  } catch {
    return model.value
  }
})

function normalizeEventKey(key: string): string | null {
  if (key.length === 1 && /^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase()
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(key)) {
    return key.toUpperCase()
  }

  return null
}

function collectModifiers(event: KeyboardEvent): ShortcutModifier[] {
  const out: ShortcutModifier[] = []

  if (event.metaKey) out.push('meta')

  if (event.ctrlKey) out.push('ctrl')

  if (event.altKey) out.push('alt')

  if (event.shiftKey) out.push('shift')

  return out
}

function modifierToToken(modifier: ShortcutModifier): string {
  switch (modifier) {
    case 'meta':
      return 'Meta'
    case 'ctrl':
      return 'Ctrl'
    case 'alt':
      return 'Alt'
    case 'shift':
      return 'Shift'
  }
}

function buildAccelerator(
  modifiers: ShortcutModifier[],
  key: string,
): string {
  const parts = modifiers.map(modifierToToken)
  parts.push(key)
  parts.push(key)

  return parts.join('+')
}

function startRecording(): void {
  recording.value = true
}

function cancelRecording(): void {
  recording.value = false
}

function clearShortcut(): void {
  recording.value = false
  model.value = ''
}

useEventListener(
  typeof window === 'undefined' ? null : window,
  'keydown',
  (event: KeyboardEvent) => {
    if (!recording.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      cancelRecording()

      return
    }

    const keyName = normalizeEventKey(event.key)

    if (keyName === null) {
      return
    }

    const modifiers = collectModifiers(event)

    if (modifiers.length === 0) {
      emit('error', 'Shortcut must include at least one modifier (Ctrl/⌘/Alt/Shift)')

      return
    }

    const accelerator = buildAccelerator(modifiers, keyName)

    try {
      parseQuickTranslateShortcut(accelerator, props.platform)
    } catch (err) {
      emit('error', err instanceof Error ? err.message : String(err))

      return
    }

    recording.value = false
    model.value = accelerator
  },
  { capture: true },
)

watch(
  () => model.value,
  () => {
    recording.value = false
  },
)
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      :aria-label="ariaLabel ?? 'Record quick-translate shortcut'"
      :class="[
        'w-full px-3 py-2 rounded-md border text-left font-mono text-sm',
        recording
          ? 'border-primary bg-primary-subtle text-default'
          : 'border-default bg-elevated text-default hover:border-primary',
      ]"
      @click="recording ? cancelRecording() : startRecording()"
    >
      <span v-if="recording">
        Press shortcut… (Esc to cancel)
      </span>
      <span v-else-if="displayValue">
        {{ displayValue }}
      </span>
      <span v-else class="text-dimmed">
        (not set — click to record)
      </span>
    </button>
    <button
      v-if="recording"
      type="button"
      aria-label="Cancel recording"
      class="px-2 py-1 text-xs text-dimmed hover:text-default"
      @click="cancelRecording"
    >
      Cancel
    </button>
    <button
      v-else-if="model"
      type="button"
      aria-label="Clear shortcut"
      class="px-2 py-1 text-xs text-dimmed hover:text-error"
      @click="clearShortcut"
    >
      Clear
    </button>
  </div>
</template>
