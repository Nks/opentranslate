<script setup lang="ts">
interface Props {
  message: string
}

interface Emits {
  dismiss: []
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<template>
  <div class="px-4 py-3 text-sm bg-elevated border-b border-default">
    <div class="flex items-start gap-2">
      <UIcon
        name="i-fluent-warning-24-regular"
        class="shrink-0 text-error mt-0.5"
      />
      <pre class="flex-1 text-error whitespace-pre-wrap wrap-break-word font-mono text-xs">{{ message }}</pre>
      <UButton
        size="xs"
        variant="ghost"
        aria-label="Dismiss error"
        @click="$emit('dismiss')"
      >
        Dismiss
      </UButton>
    </div>
  </div>
</template>
