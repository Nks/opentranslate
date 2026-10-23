export const buttonStub = {
  props: ['disabled', 'loading', 'ariaLabel', 'to'],
  emits: ['click'],
  template: '<button :disabled="disabled" :data-loading="loading" :aria-label="ariaLabel" @click="$emit(\'click\')"><slot /></button>',
}

export const badgeStub = {
  props: ['label'],
  template: '<span class="badge">{{ label }}</span>',
}

export const iconStub = {
  props: ['name'],
  template: '<i :data-icon="name" />',
}

export const progressStub = {
  template: '<div data-testid="progress" />',
}

export const documentStubs = {
  UButton: buttonStub,
  UBadge: badgeStub,
  UIcon: iconStub,
  UProgress: progressStub,
}
