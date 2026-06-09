// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSelector from '@app/components/LanguageSelector.vue'
import type { Language } from '@shared/types/language'

interface SelectMenuItemStub {
  label: string
  value: string
  code: string
}

const sampleLanguages: Language[] = [
  {
    code: 'en',
    name: 'English',
    providerCode: 'en',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'de',
    name: 'German',
    providerCode: 'de',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'ru',
    name: 'Russian',
    providerCode: 'ru',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'es',
    name: 'Spanish',
    providerCode: 'es',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    providerCode: 'pt-BR',
    supportsSource: true,
    supportsTarget: true,
  },
]

const stubs = {
  UFormField: {
    template: '<div><slot /></div>',
  },
  UTooltip: {
    props: ['text', 'prevent'],
    template: '<div :data-tooltip="text" :data-prevent="prevent"><slot /></div>',
  },
  USelectMenu: {
    name: 'USelectMenu',
    props: [
      'modelValue',
      'items',
      'placeholder',
      'disabled',
      'ariaLabel',
      'title',
      'searchInput',
      'valueKey',
      'labelKey',
      'filterFields',
      'ignoreFilter',
      'searchTerm',
    ],
    emits: ['update:modelValue', 'update:searchTerm'],
    template: `
      <div
        :data-disabled="String(Boolean(disabled))"
        :data-placeholder="placeholder"
        :data-title="title"
        :data-search-input="String(searchInput !== false)"
        :data-ignore-filter="String(Boolean(ignoreFilter))"
        :data-value-key="valueKey"
        :data-label-key="labelKey"
        :data-filter-fields="filterFields ? filterFields.join(',') : ''"
        :data-search-term="searchTerm"
        :aria-label="ariaLabel"
      >
        <div
          v-for="entry in items"
          :key="entry.value"
          :data-option="entry.value"
          :data-label="entry.label"
          :data-code="entry.code"
        >
          {{ entry.label }}
        </div>
      </div>
    `,
  },
}

interface MountOptions {
  languages: Language[]
  modelValue: string | null
  label: string
  autoDetectOption?: boolean
}

function mountSelector(options: MountOptions) {
  return mount(LanguageSelector, {
    props: options,
    global: { stubs },
  })
}

function listVisibleItems(wrapper: ReturnType<typeof mount>): SelectMenuItemStub[] {
  return wrapper.findAll('[data-option]').map((node) => ({
    label: node.attributes('data-label') ?? '',
    value: node.attributes('data-option') ?? '',
    code: node.attributes('data-code') ?? '',
  }))
}

describe('LanguageSelector empty-language gating', () => {
  it('disables the select and shows the empty-state placeholder when languages is empty', () => {
    const wrapper = mountSelector({
      languages: [],
      modelValue: null,
      label: 'Source language',
      autoDetectOption: true,
    })
    const select = wrapper.find('[data-disabled]')

    expect(select.attributes('data-disabled')).toBe('true')
    expect(select.attributes('data-placeholder')).toBe('Provider has no languages')
  })

  it('hides the search input when the selector is disabled because there are no languages', () => {
    const wrapper = mountSelector({
      languages: [],
      modelValue: null,
      label: 'Source language',
      autoDetectOption: true,
    })
    const select = wrapper.find('[data-disabled]')

    expect(select.attributes('data-search-input')).toBe('false')
  })

  it('exposes a tooltip explaining why the selector is disabled', () => {
    const wrapper = mountSelector({
      languages: [],
      modelValue: null,
      label: 'Source language',
    })
    const tooltip = wrapper.find('[data-tooltip]')

    expect(tooltip.attributes('data-tooltip')).toContain('no languages')
    expect(tooltip.attributes('data-prevent')).toBe('false')
  })

  it('is enabled and uses the standard placeholder when languages are present', () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
      autoDetectOption: true,
    })
    const select = wrapper.find('[data-disabled]')

    expect(select.attributes('data-disabled')).toBe('false')
    expect(select.attributes('data-placeholder')).toBe('Auto Detect')
    expect(wrapper.find('[data-tooltip]').attributes('data-prevent')).toBe('true')
  })
})

describe('LanguageSelector typed filtering', () => {
  it('shows the full list when the search term is empty', () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })
    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels).toEqual(expect.arrayContaining([
      'English',
      'German',
      'Russian',
      'Spanish',
      'Portuguese (Brazil)',
    ]))
  })

  it('configures the search input and filter fields for case-insensitive matching against label and code', () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })
    const select = wrapper.find('[data-disabled]')

    expect(select.attributes('data-search-input')).toBe('true')
    expect(select.attributes('data-filter-fields')).toBe('label,code')
  })

  it('keeps the Auto Detect option in the list when the search term does not match it', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: null,
      label: 'Source language',
      autoDetectOption: true,
    })

    await wrapper.findComponent({ name: 'USelectMenu' }).vm.$emit('update:searchTerm', 'ru')

    const items = listVisibleItems(wrapper)
    const labels = items.map((entry) => entry.label)

    expect(labels).toContain('Auto Detect')
    expect(labels).toContain('Russian')
    expect(labels).not.toContain('English')
    expect(labels).not.toContain('German')
  })

  it('matches languages by display name substring (case-insensitive)', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })

    await wrapper.findComponent({ name: 'USelectMenu' }).vm.$emit('update:searchTerm', 'span')

    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels).toContain('Spanish')
    expect(labels).not.toContain('English')
    expect(labels).not.toContain('German')
  })

  it('matches languages by BCP-47 code substring (case-insensitive)', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })

    await wrapper.findComponent({ name: 'USelectMenu' }).vm.$emit('update:searchTerm', 'pt-BR')

    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels).toContain('Portuguese (Brazil)')
    expect(labels).not.toContain('English')
    expect(labels).not.toContain('Russian')
  })

  it('matches typing the short code in lower case', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })

    await wrapper.findComponent({ name: 'USelectMenu' }).vm.$emit('update:searchTerm', 'en')

    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels).toContain('English')
  })

  it('returns the full list (including Auto Detect) when the search term clears back to empty', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: null,
      label: 'Source language',
      autoDetectOption: true,
    })
    const menu = wrapper.findComponent({ name: 'USelectMenu' })

    await menu.vm.$emit('update:searchTerm', 'ru')
    await menu.vm.$emit('update:searchTerm', '')

    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels).toEqual(expect.arrayContaining([
      'Auto Detect',
      'English',
      'German',
      'Russian',
      'Spanish',
      'Portuguese (Brazil)',
    ]))
  })

  it('runs filtering inside the component instead of delegating to the menu', () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
    })
    const select = wrapper.find('[data-disabled]')

    expect(select.attributes('data-ignore-filter')).toBe('true')
  })
})

describe('LanguageSelector model binding', () => {
  it('emits the BCP-47 code when a real language is picked', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Target language',
    })

    await wrapper.findComponent({ name: 'USelectMenu' }).vm.$emit('update:modelValue', 'ru')

    const emitted = wrapper.emitted('update:modelValue')

    expect(emitted?.[emitted.length - 1]?.[0]).toBe('ru')
  })

  it('emits null when the Auto Detect option is picked', async () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: 'en',
      label: 'Source language',
      autoDetectOption: true,
    })

    await wrapper
      .findComponent({ name: 'USelectMenu' })
      .vm.$emit('update:modelValue', '__auto__')

    const emitted = wrapper.emitted('update:modelValue')

    expect(emitted?.[emitted.length - 1]?.[0]).toBeNull()
  })

  it('renders Auto Detect at the top of the list when autoDetectOption is true', () => {
    const wrapper = mountSelector({
      languages: sampleLanguages,
      modelValue: null,
      label: 'Source language',
      autoDetectOption: true,
    })

    const labels = listVisibleItems(wrapper).map((entry) => entry.label)

    expect(labels[0]).toBe('Auto Detect')
  })
})
