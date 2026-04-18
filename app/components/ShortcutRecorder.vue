<script setup lang="ts">
import {
  computed, ref, watch,
} from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  formatShortcutForDisplay,
  parseQuickTranslateShortcut,
  type ShortcutModifier,
} from '@shared/shortcuts/quick-translate'

interface Props {
  /** Current accelerator string (e.g. `"CommandOrControl+C+C"`). */
  modelValue: string
  /**
   * Host platform. `process.platform` isn't available in the renderer, so
   * the parent page is responsible for passing the OS hint captured at
   * mount time via `api.getPlatform()`.
   */
  platform: NodeJS.Platform | 'darwin' | 'win32' | 'linux' | string
  /** Optional label for accessibility. */
  ariaLabel?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'error', message: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const recording = ref<boolean>(false)

/**
 * Display copy of the current accelerator rendered with platform glyphs.
 * Parsing may throw (e.g. when a persisted value doesn't match current
 * rules); fall back to the raw string in that case.
 */
const displayValue = computed<string>(() => {
  try {
    const parsed = parseQuickTranslateShortcut(props.modelValue, props.platform)

    return formatShortcutForDisplay(parsed, props.platform)
  } catch {
    return props.modelValue
  }
})

/**
 * Map a browser `KeyboardEvent.key` to our canonical key name. Only
 * accepts ASCII letters and F1..F24; everything else returns null so the
 * caller can keep listening for a valid trailing key.
 */
function normalizeEventKey(key: string): string | null {
  if (key.length === 1 && /^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase()
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(key)) {
    return key.toUpperCase()
  }

  return null
}

/**
 * Pull the held modifiers off the native event in canonical order.
 * Never includes the non-modifier trailing key.
 */
function collectModifiers(event: KeyboardEvent): ShortcutModifier[] {
  const out: ShortcutModifier[] = []

  if (event.metaKey) out.push('meta')

  if (event.ctrlKey) out.push('ctrl')

  if (event.altKey) out.push('alt')

  if (event.shiftKey) out.push('shift')

  return out
}

/**
 * Convert a canonical modifier into the string token used inside
 * Electron-style accelerator strings. We stick with platform-neutral
 * names so the stored value is portable.
 */
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
  // `chord: 'double'` is our fixed pattern for the quick-translate
  // shortcut in this iteration — repeat the trailing key.
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
  emit('update:modelValue', '')
}

/**
 * Global keydown listener. We intentionally capture rather than bubble so
 * we intercept before any `<input>` focus handlers, and we always call
 * `preventDefault` so recording `Ctrl+W` etc. doesn't close the window.
 */
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
      // User is still building the combo (pressed a modifier).
      return
    }

    const modifiers = collectModifiers(event)

    if (modifiers.length === 0) {
      emit('error', 'Shortcut must include at least one modifier (Ctrl/⌘/Alt/Shift)')

      return
    }

    const accelerator = buildAccelerator(modifiers, keyName)

    try {
      // Round-trip through the parser so we surface the same validation
      // the main process and schema apply.
      parseQuickTranslateShortcut(accelerator, props.platform)
    } catch (err) {
      emit('error', err instanceof Error ? err.message : String(err))

      return
    }

    recording.value = false
    emit('update:modelValue', accelerator)
  },
  { capture: true },
)

// Reset recording state if the parent changes the value externally.
watch(
  () => props.modelValue,
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
      v-else-if="modelValue"
      type="button"
      aria-label="Clear shortcut"
      class="px-2 py-1 text-xs text-dimmed hover:text-error"
      @click="clearShortcut"
    >
      Clear
    </button>
  </div>
</template>
