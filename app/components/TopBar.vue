<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'

interface Props {
  providers: ProviderDescriptorDto[]
  activeProviderId: string | null
  sourceLanguages: Language[]
  sourceCode: string | null
  targetLanguages: Language[]
  targetLanguage: string | null
  swapDisabled: boolean
  navItems: NavigationMenuItem[]
}

interface Emits {
  switch: [providerId: string]
  'source-change': [code: string | null]
  'target-change': [code: string | null]
  swap: []
}

defineProps<Props>()
defineEmits<Emits>()
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
