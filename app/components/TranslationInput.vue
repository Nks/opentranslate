<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
}

interface Emits {
  'update:modelValue': [value: string]
  clear: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const charCount = computed<number>(() => props.modelValue.length)
</script>

<template>
  <div class="flex flex-col h-full">
    <UTextarea
      :model-value="modelValue"
      placeholder="Type or paste text here..."
      aria-label="Source text"
      autofocus
      :rows="10"
      class="flex-1"
      @update:model-value="(val: string) => emit('update:modelValue', val)"
    />
    <div class="flex items-center justify-between mt-2 px-1 text-sm text-gray-500 dark:text-gray-400">
      <span>{{ charCount }} characters</span>
      <UButton
        v-if="modelValue.length > 0"
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
