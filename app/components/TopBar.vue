<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import type {
  ProviderLanguageControlsEmits,
  ProviderLanguageControlsProps,
} from '@app/types/provider-language-controls'

interface Emits extends ProviderLanguageControlsEmits {
  swap: []
}

const props = defineProps<ProviderLanguageControlsProps>()
defineEmits<Emits>()

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
        <UButton
          size="xs"
          variant="ghost"
          icon="i-fluent-arrow-swap-24-regular"
          aria-label="Swap languages"
          :disabled="swapDisabled"
          @click="$emit('swap')"
        />
      </template>
    </ProviderLanguageControls>
    <div class="ml-auto flex items-center gap-1">
      <UNavigationMenu
        :items="navItems"
        variant="pill"
      />
      <UColorModeButton />
    </div>
  </div>
</template>
