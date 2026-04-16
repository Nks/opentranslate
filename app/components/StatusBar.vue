<script setup lang="ts">
interface Props {
  loading: boolean
  error: string | null
}

interface Emits {
  retry: []
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-2 text-sm border-t border-gray-200 dark:border-gray-700">
    <UIcon
      v-if="loading"
      name="i-heroicons-arrow-path"
      class="animate-spin text-primary-500"
    />
    <span
      v-if="error"
      class="text-red-600 dark:text-red-400 flex-1 truncate"
    >
      {{ error }}
    </span>
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
      class="text-gray-400"
    >
      Ready
    </span>
  </div>
</template>
