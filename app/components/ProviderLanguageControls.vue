<script setup lang="ts">
import { computed } from 'vue'
import type {
  ProviderLanguageControlsEmits,
  ProviderLanguageControlsProps,
} from '@app/types/provider-language-controls'

const props = defineProps<ProviderLanguageControlsProps>()
defineEmits<ProviderLanguageControlsEmits>()

const sourceCode = computed<string | null>((): string | null =>
  props.sourceSelection.mode === 'explicit' ? props.sourceSelection.code : null,
)
</script>

<template>
  <ProviderSelector
    :providers
    :active-id="activeProviderId"
    @switch="$emit('switch', $event)"
  />
  <LanguageSelector
    :languages="sourceLanguages"
    :model-value="sourceCode"
    label="Source language"
    :auto-detect-option="true"
    @update:model-value="$emit('source-change', $event)"
  />
  <slot name="between" />
  <LanguageSelector
    :languages="targetLanguages"
    :model-value="targetLanguage"
    label="Target language"
    @update:model-value="$emit('target-change', $event)"
  />
</template>
