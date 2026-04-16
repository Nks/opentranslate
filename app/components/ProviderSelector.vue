<script setup lang="ts">
import { computed } from 'vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'

interface Props {
  providers: ProviderDescriptorDto[]
  activeId: string | null
}

interface Emits {
  switch: [providerId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const items = computed<string[]>(() =>
  props.providers.map((provider) => provider.displayName),
)

const selectedName = computed<string>(() => {
  const found = props.providers.find((provider) => provider.id === props.activeId)

  return found?.displayName ?? ''
})

function onChange(name: string) {
  const found = props.providers.find((provider) => provider.displayName === name)

  if (found) {
    emit('switch', found.id)
  }
}
</script>

<template>
  <USelect
    :model-value="selectedName"
    :items="items"
    placeholder="Select provider"
    aria-label="Translation provider"
    class="w-48"
    @update:model-value="onChange"
  />
</template>
