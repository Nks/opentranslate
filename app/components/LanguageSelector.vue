<script setup lang="ts">
import { computed } from 'vue'
import type { Language } from '@shared/types/language'

interface Props {
  languages: Language[]
  label: string
  autoDetectOption?: boolean
}

const props = defineProps<Props>()
const model = defineModel<string | null>({ required: true })

const codeToName = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()

  for (const lang of props.languages) {
    map.set(lang.code, lang.name)
  }

  return map
})

const isEmpty = computed<boolean>((): boolean => props.languages.length === 0)

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

const placeholder = computed<string>(() => {
  if (isEmpty.value) {
    return 'Provider has no languages'
  }

  return props.autoDetectOption ? 'Auto Detect' : 'Select language'
})

const disabledTitle = computed<string>(() =>
  isEmpty.value
    ? 'Active provider returned no languages — pick another provider in Settings'
    : '',
)

function onChange(name: string): void {
  if (name === 'Auto Detect') {
    model.value = null

    return
  }

  model.value = props.languages.find((lang) => lang.name === name)?.code ?? name
}
</script>

<template>
  <UFormField>
    <UTooltip
      :text="disabledTitle"
      :prevent="!isEmpty"
    >
      <USelect
        :model-value="selectedName"
        :items
        :placeholder
        :disabled="isEmpty"
        :aria-label="label"
        :title="disabledTitle"
        class="w-40"
        @update:model-value="onChange"
      />
    </UTooltip>
  </UFormField>
</template>
