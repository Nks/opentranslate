<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  checking: boolean
  supported: boolean
  message: string
  formats: string[]
}

const props = defineProps<Props>()

const iconName = computed<string>(() => {
  if (props.checking) {
    return 'i-fluent-arrow-sync-24-regular'
  }

  return props.supported
    ? 'i-fluent-checkmark-circle-24-regular'
    : 'i-fluent-warning-24-regular'
})

const toneClass = computed<string>(() => {
  if (props.checking) {
    return 'text-muted'
  }

  return props.supported ? 'text-success' : 'text-warning'
})

const showFormats = computed<boolean>(() => props.supported && props.formats.length > 0)
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    aria-label="Document capability"
    class="w-full max-w-xl flex flex-col gap-2 px-4 py-3 rounded-lg bg-elevated"
  >
    <div
      class="flex items-center gap-2 text-sm"
      :class="toneClass"
    >
      <UIcon
        :name="iconName"
        class="size-5 shrink-0"
        :class="{ 'animate-spin': checking }"
      />
      <span>{{ message }}</span>
    </div>
    <ul
      v-if="showFormats"
      class="flex flex-wrap gap-1"
      aria-label="Supported formats"
    >
      <li
        v-for="format in formats"
        :key="format"
      >
        <UBadge
          :label="format"
          color="neutral"
          variant="subtle"
          size="sm"
        />
      </li>
    </ul>
  </div>
</template>
