<script setup lang="ts">
import { ref } from 'vue'
import { useClipboard } from '@vueuse/core'

interface Props {
  loading: boolean
  error: string | null
  errorDetail?: string | null
}

interface Emits {
  retry: []
}

const props = withDefaults(defineProps<Props>(), { errorDetail: null })
const emit = defineEmits<Emits>()

const detailsOpen = ref<boolean>(false)
const { copy: copyDetail, copied } = useClipboard({ copiedDuring: 2000 })

async function copyErrorDetail(): Promise<void> {
  if (props.errorDetail) {
    await copyDetail(props.errorDetail)
  }
}

function toggleDetails(): void {
  detailsOpen.value = !detailsOpen.value
}
</script>

<template>
  <div class="border-t border-default">
    <div class="flex items-center gap-2 px-4 py-2 text-sm">
      <UIcon
        v-if="loading"
        name="i-fluent-arrow-sync-24-regular"
        class="animate-spin text-primary"
      />
      <span
        v-if="error"
        class="text-error flex-1 truncate"
      >
        {{ error }}
      </span>
      <UButton
        v-if="error && errorDetail"
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
        v-if="error"
        size="xs"
        variant="ghost"
        aria-label="Retry translation"
        @click="emit('retry')"
      >
        Retry
      </UButton>
      <span
        v-if="!loading && !error"
        class="text-dimmed"
      >
        Ready
      </span>
    </div>
    <div
      v-if="error && errorDetail && detailsOpen"
      class="px-4 py-3 bg-elevated border-t border-default flex flex-col gap-2"
    >
      <pre
        class="text-xs font-mono text-error whitespace-pre-wrap wrap-break-word max-h-64 overflow-y-auto"
        aria-label="Full error detail"
      >{{ errorDetail }}</pre>
      <div class="flex justify-end">
        <UButton
          size="xs"
          variant="soft"
          :icon="copied ? 'i-fluent-checkmark-24-regular' : 'i-fluent-copy-24-regular'"
          aria-label="Copy error detail"
          @click="copyErrorDetail"
        >
          {{ copied ? 'Copied' : 'Copy' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
