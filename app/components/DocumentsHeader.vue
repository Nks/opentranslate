<script setup lang="ts">
import { computed } from 'vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'

interface Props {
  providers: ProviderDescriptorDto[]
  activeProviderId: string | null
  sourceLanguages: Language[]
  targetLanguages: Language[]
  sourceSelection: SourceLanguageSelection
  targetLanguage: string | null
}

interface Emits {
  switch: [providerId: string]
  'source-change': [code: string | null]
  'target-change': [code: string | null]
}

const props = defineProps<Props>()
defineEmits<Emits>()

const sourceCode = computed<string | null>((): string | null =>
  props.sourceSelection.mode === 'explicit' ? props.sourceSelection.code : null,
)
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
    <UIcon
      name="i-fluent-arrow-right-24-regular"
      class="text-dimmed"
    />
    <LanguageSelector
      :languages="targetLanguages"
      :model-value="targetLanguage"
      label="Target language"
      @update:model-value="$emit('target-change', $event)"
    />
  </div>
</template>
