<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Language } from '@shared/types/language'

interface Props {
  languages: Language[]
  label: string
  autoDetectOption?: boolean
}

interface LanguageItem {
  label: string
  value: string
  code: string
}

const AUTO_DETECT_VALUE = '__auto__'
const AUTO_DETECT_LABEL = 'Auto Detect'

const props = withDefaults(defineProps<Props>(), {
  autoDetectOption: false,
})

const model = defineModel<string | null>({ required: true })

const searchTerm = ref<string>('')

const isEmpty = computed<boolean>(() => props.languages.length === 0)

const autoDetectItem = computed<LanguageItem>(() => ({
  label: AUTO_DETECT_LABEL,
  value: AUTO_DETECT_VALUE,
  code: 'auto',
}))

const languageItems = computed<LanguageItem[]>(() =>
  props.languages.map((language) => ({
    label: language.name,
    value: language.code,
    code: language.code,
  })),
)

const allItems = computed<LanguageItem[]>(() => {
  if (props.autoDetectOption) {
    return [autoDetectItem.value, ...languageItems.value]
  }

  return languageItems.value
})

const filteredItems = computed<LanguageItem[]>(() => {
  const query = searchTerm.value.trim().toLowerCase()

  if (query === '') {
    return allItems.value
  }

  const matchedLanguages = languageItems.value.filter((item) => {
    const labelMatches = item.label.toLowerCase().includes(query)
    const codeMatches = item.code.toLowerCase().includes(query)

    return labelMatches || codeMatches
  })

  if (props.autoDetectOption) {
    return [autoDetectItem.value, ...matchedLanguages]
  }

  return matchedLanguages
})

const selectedValue = computed<string | null>(() => {
  if (model.value === null) {
    return props.autoDetectOption ? AUTO_DETECT_VALUE : null
  }

  return model.value
})

const placeholder = computed<string>(() => {
  if (isEmpty.value) {
    return 'Provider has no languages'
  }

  return props.autoDetectOption ? AUTO_DETECT_LABEL : 'Select language'
})

const disabledTitle = computed<string>(() =>
  isEmpty.value
    ? 'Active provider returned no languages — pick another provider in Settings'
    : '',
)

const searchInputConfig = computed<false | { placeholder: string }>(() => {
  if (isEmpty.value) {
    return false
  }

  return { placeholder: 'Search languages...' }
})

function onSelect(value: string | null): void {
  if (value === null || value === AUTO_DETECT_VALUE) {
    model.value = null

    return
  }

  model.value = value
}

function onSearchTermUpdate(term: string): void {
  searchTerm.value = term
}
</script>

<template>
  <UFormField>
    <UTooltip
      :text="disabledTitle"
      :prevent="!isEmpty"
    >
      <USelectMenu
        :model-value="selectedValue"
        :items="filteredItems"
        :placeholder
        :disabled="isEmpty"
        :aria-label="label"
        :title="disabledTitle"
        :search-input="searchInputConfig"
        :search-term="searchTerm"
        :filter-fields="['label', 'code']"
        value-key="value"
        label-key="label"
        :ignore-filter="true"
        class="w-40"
        @update:model-value="onSelect"
        @update:search-term="onSearchTermUpdate"
      />
    </UTooltip>
  </UFormField>
</template>
