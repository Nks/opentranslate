<script setup lang="ts">
import type {
  ProviderLanguageControlsEmits,
  ProviderLanguageControlsProps,
} from '@app/types/provider-language-controls'

defineProps<ProviderLanguageControlsProps>()
defineEmits<ProviderLanguageControlsEmits>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-default">
    <UButton
      to="/"
      variant="ghost"
      size="xs"
      icon="i-fluent-arrow-left-24-regular"
      label="Translate"
      aria-label="Back to translate"
    />
    <h1 class="text-lg font-semibold">
      Documents
    </h1>
    <ProviderLanguageControls
      :providers
      :active-provider-id
      :source-languages
      :target-languages
      :source-selection
      :target-language
      @switch="$emit('switch', $event)"
      @source-change="$emit('source-change', $event)"
      @target-change="$emit('target-change', $event)"
    >
      <template #between>
        <UIcon
          name="i-fluent-arrow-right-24-regular"
          class="text-dimmed"
        />
      </template>
    </ProviderLanguageControls>
  </div>
</template>
