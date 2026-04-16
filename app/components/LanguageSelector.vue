<script setup lang="ts">
import type { Language } from '@shared/types/language'

interface Props {
  languages: Language[]
  modelValue: string | null
  label: string
  autoDetectOption?: boolean
}

interface Emits {
  'update:modelValue': [value: string | null]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function onChange(value: string | null) {
  emit('update:modelValue', value)
}
</script>

<template>
  <UFormField :label="props.label">
    <USelect
      :model-value="modelValue"
      :aria-label="props.label"
      @update:model-value="onChange"
    >
      <option
        v-if="props.autoDetectOption"
        :value="null"
      >
        Auto Detect
      </option>
      <option
        v-for="lang in props.languages"
        :key="lang.code"
        :value="lang.code"
      >
        {{ lang.name }}
      </option>
    </USelect>
  </UFormField>
</template>
