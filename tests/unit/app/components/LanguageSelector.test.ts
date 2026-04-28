// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSelector from '@app/components/LanguageSelector.vue'
import type { Language } from '@shared/types/language'

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
]

const stubs = {
  UFormField: {
    template: '<div><slot /></div>',
  },
  UTooltip: {
    props: ['text', 'prevent'],
    template: '<div :data-tooltip="text" :data-prevent="prevent"><slot /></div>',
  },
  USelect: {
    props: ['modelValue', 'items', 'placeholder', 'disabled', 'ariaLabel', 'title'],
    template:
      '<select :data-disabled="disabled" :data-placeholder="placeholder" :data-title="title" :aria-label="ariaLabel"><slot /></select>',
  },
}

describe('LanguageSelector empty-language gating', () => {
  it('disables the select and shows the empty-state placeholder when languages is empty', () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        languages: [],
        modelValue: null,
        label: 'Source language',
        autoDetectOption: true,
      },
      global: { stubs },
    })
    const select = wrapper.find('select')

    expect(select.attributes('data-disabled')).toBe('true')
    expect(select.attributes('data-placeholder')).toBe('Provider has no languages')
  })

  it('exposes a tooltip explaining why the selector is disabled', () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        languages: [],
        modelValue: null,
        label: 'Source language',
      },
      global: { stubs },
    })
    const tooltip = wrapper.find('[data-tooltip]')

    expect(tooltip.attributes('data-tooltip')).toContain('no languages')
    expect(tooltip.attributes('data-prevent')).toBe('false')
  })

  it('is enabled and uses the standard placeholder when languages are present', () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        languages: sampleLanguages,
        modelValue: 'en',
        label: 'Source language',
        autoDetectOption: true,
      },
      global: { stubs },
    })
    const select = wrapper.find('select')

    expect(select.attributes('data-disabled')).toBe('false')
    expect(select.attributes('data-placeholder')).toBe('Auto Detect')
    expect(wrapper.find('[data-tooltip]').attributes('data-prevent')).toBe('true')
  })
})
