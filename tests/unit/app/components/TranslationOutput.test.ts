// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationOutput from '@app/components/TranslationOutput.vue'

describe('TranslationOutput disabled state', () => {
  const stubs = {
    UTextarea: {
      props: ['placeholder', 'disabled', 'readonly', 'modelValue'],
      template: '<textarea :placeholder="placeholder" :disabled="disabled" :readonly="readonly" :value="modelValue" />',
    },
    UIcon: true,
    UButton: true,
  }

  it('shows the "configure a provider" placeholder when disabled', () => {
    const wrapper = mount(TranslationOutput, {
      props: {
        text: '',
        provider: null,
        loading: false,
        disabled: true,
      },
      global: { stubs },
    })

    expect(wrapper.find('textarea').attributes('placeholder'))
      .toContain('Configure a provider')
  })

  it('applies the disabled attribute when disabled', () => {
    const wrapper = mount(TranslationOutput, {
      props: {
        text: '',
        provider: null,
        loading: false,
        disabled: true,
      },
      global: { stubs },
    })

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
  })

  it('is read-only but not disabled when enabled', () => {
    const wrapper = mount(TranslationOutput, {
      props: {
        text: 'Hola',
        provider: 'libretranslate',
        loading: false,
        disabled: false,
      },
      global: { stubs },
    })
    const textarea = wrapper.find('textarea')

    expect(textarea.attributes('disabled')).toBeUndefined()
    expect(textarea.attributes('readonly')).toBeDefined()
  })
})
