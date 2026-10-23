<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  disabled: boolean
  dragging: boolean
  fileName: string
}

interface Emits {
  pick: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const zoneClass = computed<string>(() => {
  if (props.disabled) {
    return 'border-default opacity-50'
  }

  return props.dragging ? 'border-primary bg-primary/5' : 'border-default'
})

const hint = computed<string>(() =>
  props.disabled ? 'Document translation is unavailable' : 'Drop a document here',
)
</script>

<template>
  <div
    aria-label="Document drop zone"
    :aria-disabled="disabled"
    class="w-full max-w-xl border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center transition-colors"
    :class="zoneClass"
  >
    <UIcon
      name="i-fluent-arrow-upload-24-regular"
      class="size-8 text-dimmed"
    />
    <p
      v-if="fileName"
      class="text-sm font-medium break-all"
      aria-label="Selected document"
    >
      {{ fileName }}
    </p>
    <p
      v-else
      class="text-sm text-muted"
    >
      {{ hint }}
    </p>
    <UButton
      :disabled
      variant="soft"
      icon="i-fluent-folder-open-24-regular"
      aria-label="Choose file"
      @click="$emit('pick')"
    >
      {{ fileName ? 'Choose another file' : 'Choose file' }}
    </UButton>
  </div>
</template>
