export const providerSelectorStub = {
  props: ['providers', 'activeId'],
  emits: ['switch'],
  template: '<select data-testid="provider" :data-active="activeId" @change="$emit(\'switch\', \'libretranslate\')" />',
}

export const languageSelectorStub = {
  props: ['languages', 'modelValue', 'label', 'autoDetectOption'],
  emits: ['update:modelValue'],
  template: '<select :aria-label="label" :data-value="modelValue" :data-auto="autoDetectOption" @change="$emit(\'update:modelValue\', \'en\')" />',
}
