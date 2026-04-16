<script setup lang="ts">
import { computed } from 'vue'
import { useVModel } from '@vueuse/core'

interface Props {
  modelValue: string
}

interface Emits {
  'update:modelValue': [value: string]
  clear: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const model = useVModel(props, 'modelValue', emit)
const charCount = computed<number>(() => model.value.length)
</script>

<template>
  <div class="flex flex-col h-full">
    <UTextarea
      v-model="model"
      placeholder="Type or paste text here..."
      aria-label="Source text"
      autofocus
      variant="none"
      class="flex-1 w-full [&_textarea]:h-full [&_textarea]:w-full [&_textarea]:resize-none"
      :ui="{ root: 'h-full w-full', base: 'h-full w-full' }"
    />
    <div class="flex items-center justify-between mt-2 px-1 text-sm text-muted">
      <span>{{ charCount }} characters</span>
      <UButton
        v-if="model.length > 0"
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
