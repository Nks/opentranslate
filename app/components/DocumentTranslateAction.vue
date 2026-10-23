<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  canTranslate: boolean
  translating: boolean
  fileName: string
  targetLabel: string | null
  blockedReason: string | null
}

interface Emits {
  translate: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const buttonLabel = computed<string>(() =>
  props.targetLabel ? `Translate to ${props.targetLabel}` : 'Translate',
)

const progressText = computed<string>(() =>
  `Translating ${props.fileName} to ${props.targetLabel ?? 'the target language'}…`,
)
</script>

<template>
  <div class="w-full max-w-xl flex flex-col items-center gap-2">
    <UButton
      :loading="translating"
      :disabled="!canTranslate"
      icon="i-fluent-translate-24-regular"
      aria-label="Translate document"
      @click="$emit('translate')"
    >
      {{ buttonLabel }}
    </UButton>
    <div
      v-if="translating"
      class="w-full flex flex-col gap-1"
    >
      <UProgress
        size="sm"
        animation="carousel"
        aria-label="Translating document"
      />
      <p
        role="status"
        aria-live="polite"
        class="text-xs text-muted text-center"
      >
        {{ progressText }}
      </p>
    </div>
    <p
      v-else-if="blockedReason"
      class="text-xs text-muted text-center"
    >
      {{ blockedReason }}
    </p>
  </div>
</template>
