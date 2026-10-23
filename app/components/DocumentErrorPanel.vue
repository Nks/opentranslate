<script setup lang="ts">
import {
  computed, ref,
} from 'vue'
import { useClipboard } from '@vueuse/core'
import {
  formatErrorCategory, type FormattedError,
} from '@shared/errors/format'

interface Props {
  error: FormattedError
}

interface Emits {
  dismiss: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const detailsOpen = ref<boolean>(false)
const { copy: copyDetail, copied } = useClipboard({ copiedDuring: 2000 })

const categoryLabel = computed<string>(() => formatErrorCategory(props.error.category))

function toggleDetails(): void {
  detailsOpen.value = !detailsOpen.value
}
</script>

<template>
  <div
    role="alert"
    class="w-full max-w-xl rounded-lg border border-error/40 bg-error/5 px-4 py-3 flex flex-col gap-2 text-sm"
  >
    <div class="flex items-start gap-2">
      <UIcon
        name="i-fluent-error-circle-24-regular"
        class="size-5 shrink-0 text-error"
      />
      <div class="flex-1 flex flex-col gap-1">
        <p class="font-medium text-error">
          {{ error.short }}
        </p>
        <p
          class="text-xs text-muted"
          aria-label="Error category"
        >
          {{ categoryLabel }}
        </p>
      </div>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-fluent-dismiss-24-regular"
        aria-label="Dismiss error"
        @click="$emit('dismiss')"
      />
    </div>
    <div class="flex gap-2">
      <UButton
        size="xs"
        variant="ghost"
        :icon="detailsOpen ? 'i-fluent-chevron-up-24-regular' : 'i-fluent-chevron-down-24-regular'"
        :aria-label="detailsOpen ? 'Hide error details' : 'Show error details'"
        :aria-expanded="detailsOpen"
        @click="toggleDetails"
      >
        {{ detailsOpen ? 'Hide details' : 'Show details' }}
      </UButton>
      <UButton
        v-if="detailsOpen"
        size="xs"
        variant="soft"
        :icon="copied ? 'i-fluent-checkmark-24-regular' : 'i-fluent-copy-24-regular'"
        aria-label="Copy error details"
        @click="copyDetail(error.detail)"
      >
        {{ copied ? 'Copied' : 'Copy' }}
      </UButton>
    </div>
    <pre
      v-if="detailsOpen"
      class="text-xs font-mono text-error whitespace-pre-wrap wrap-break-word max-h-64 overflow-y-auto"
      aria-label="Full error detail"
    >{{ error.detail }}</pre>
  </div>
</template>
