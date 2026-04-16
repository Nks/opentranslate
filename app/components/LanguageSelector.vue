<script setup lang="ts">
import { computed } from 'vue'
import { useVModel } from '@vueuse/core'
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

const model = useVModel(props, 'modelValue', emit)

const codeToName = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()

  for (const lang of props.languages) {
    map.set(lang.code, lang.name)
  }

  return map
})

const items = computed<string[]>(() => {
  const names = props.languages.map((lang) => lang.name)

  if (props.autoDetectOption) {
    return ['Auto Detect', ...names]
  }

  return names
})

const selectedName = computed<string>(() => {
  if (model.value === null) {
    return 'Auto Detect'
  }

  return codeToName.value.get(model.value) ?? model.value
})

function onChange(name: string) {
  if (name === 'Auto Detect') {
    model.value = null

    return
  }

  model.value = props.languages.find((lang) => lang.name === name)?.code ?? name
}
</script>

<template>
  <UFormField>
    <USelect
      :model-value="selectedName"
      :items="items"
      :placeholder="autoDetectOption ? 'Auto Detect' : 'Select language'"
      :aria-label="label"
      class="w-40"
      @update:model-value="onChange"
    />
  </UFormField>
</template>
