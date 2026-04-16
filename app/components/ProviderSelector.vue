<script setup lang="ts">
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'

interface Props {
  providers: ProviderDescriptorDto[]
  activeId: string | null
}

interface Emits {
  switch: [providerId: string]
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <USelect
    :model-value="activeId"
    aria-label="Translation provider"
    @update:model-value="(val: string) => emit('switch', val)"
  >
    <option
      v-for="provider in providers"
      :key="provider.id"
      :value="provider.id"
    >
      {{ provider.displayName }}
    </option>
  </USelect>
</template>
