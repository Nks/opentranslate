<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
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
  swap: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const sourceCode = computed<string | null>((): string | null =>
  props.sourceSelection.mode === 'explicit' ? props.sourceSelection.code : null,
)

const swapDisabled = computed<boolean>(
  (): boolean => props.sourceSelection.mode === 'auto',
)

const navItems: NavigationMenuItem[] = [
  { label: 'History', icon: 'i-fluent-history-24-regular', to: '/history' },
  { label: 'Documents', icon: 'i-fluent-document-24-regular', to: '/documents' },
  { label: 'Settings', icon: 'i-fluent-settings-24-regular', to: '/settings' },
]
</script>

<template>
  <div class="flex items-center gap-4 px-4 py-3 border-b border-default">
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
    <UButton
      size="xs"
      variant="ghost"
      icon="i-fluent-arrow-swap-24-regular"
      aria-label="Swap languages"
      :disabled="swapDisabled"
      @click="$emit('swap')"
    />
    <LanguageSelector
      :languages="targetLanguages"
      :model-value="targetLanguage"
      label="Target language"
      @update:model-value="$emit('target-change', $event)"
    />
    <div class="ml-auto flex items-center gap-1">
      <UNavigationMenu
        :items="navItems"
        variant="pill"
      />
      <UColorModeButton />
    </div>
  </div>
</template>
