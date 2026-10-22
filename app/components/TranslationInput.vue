<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  disabled?: boolean
}

interface Emits {
  clear: []
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const model = defineModel<string>({ required: true })
const emit = defineEmits<Emits>()

const charCount = computed<number>(() => model.value.length)
const placeholder = computed<string>(() =>
  props.disabled ? 'Configure a provider to translate' : 'Type or paste text here...',
)
</script>

<template>
  <div
    class="flex flex-col h-full"
    :class="{ 'opacity-60': disabled }"
  >
    <UTextarea
      v-model="model"
      :placeholder
      :disabled
      :readonly="disabled"
      aria-label="Source text"
      autofocus
      variant="none"
      class="flex-1 w-full [&_textarea]:h-full [&_textarea]:w-full [&_textarea]:resize-none"
      :ui="{ root: 'h-full w-full', base: 'h-full w-full' }"
    />
    <div class="flex items-center justify-between mt-2 px-1 text-sm text-muted">
      <span>{{ charCount }} characters</span>
      <UButton
        v-if="model.length > 0 && !disabled"
        size="xs"
        variant="ghost"
        aria-label="Clear input"
        @click="emit('clear')"
      >
        Clear
      </UButton>
    </div>
  </div>
</template>
