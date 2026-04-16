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
  <div class="flex items-center gap-2 px-4 py-2 text-sm border-t border-default">
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
</template>
