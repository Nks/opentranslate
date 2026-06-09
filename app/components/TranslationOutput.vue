<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'

interface Props {
  text: string
  provider: string | null
  loading: boolean
  disabled?: boolean
}

interface Emits {
  copy: []
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const emit = defineEmits<Emits>()

const { copy: copyText, copied } = useClipboard({ copiedDuring: 2000 })

const placeholder = computed<string>(() =>
  props.disabled ? 'Configure a provider to translate' : '',
)

const copyButtonLabel = computed<string>(() => copied.value ? 'Copied' : 'Copy')
const copyButtonIcon = computed<string>(() =>
  copied.value ? 'i-fluent-checkmark-24-regular' : 'i-fluent-copy-24-regular',
)

async function copyToClipboard(): Promise<void> {
  await copyText(props.text)
  emit('copy')
}
</script>

<template>
  <div
    class="flex flex-col h-full"
    :class="{ 'opacity-60': disabled }"
  >
    <div class="relative flex-1">
      <UTextarea
        :model-value="text"
        :placeholder
        :disabled
        readonly
        aria-label="Translated text"
        variant="none"
        class="flex-1 w-full [&_textarea]:h-full [&_textarea]:w-full [&_textarea]:resize-none"
        :ui="{ root: 'h-full w-full', base: 'h-full w-full' }"
      />
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-elevated/50"
      >
        <UIcon
          name="i-fluent-arrow-sync-24-regular"
          class="animate-spin text-primary"
        />
      </div>
    </div>
    <div class="flex items-center justify-between mt-2 px-1 text-sm text-muted">
      <span v-if="provider">
        {{ provider }}
      </span>
      <UButton
        v-if="text.length > 0 && !disabled"
        size="xs"
        variant="ghost"
        :icon="copyButtonIcon"
        :aria-label="copied ? 'Translation copied' : 'Copy translation'"
        @click="copyToClipboard"
      >
        {{ copyButtonLabel }}
      </UButton>
    </div>
  </div>
</template>
