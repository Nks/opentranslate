// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationInput from '@app/components/TranslationInput.vue'

describe('TranslationInput', () => {
  it('renders with empty modelValue', () => {
    const wrapper = mount(TranslationInput, {
      props: { modelValue: '' },
      global: {
        stubs: {
          UTextarea: true,
          UButton: true,
        },
      },
    })

    expect(wrapper.text()).toContain('0 characters')
  })

  it('displays character count from modelValue', () => {
    const wrapper = mount(TranslationInput, {
      props: { modelValue: 'hello' },
      global: {
        stubs: {
          UTextarea: true,
          UButton: true,
        },
      },
    })

    expect(wrapper.text()).toContain('5 characters')
  })

  it('hides clear button when modelValue is empty', () => {
    const wrapper = mount(TranslationInput, {
      props: { modelValue: '' },
      global: {
        stubs: {
          UTextarea: true,
          UButton: true,
        },
      },
    })
    const clearButton = wrapper.findComponent({ name: 'UButton' })

    expect(clearButton.exists()).toBe(false)
  })

  it('shows clear button when modelValue is non-empty', () => {
    const wrapper = mount(TranslationInput, {
      props: { modelValue: 'text' },
      global: {
        stubs: {
          UTextarea: {
            template: '<textarea />',
          },
          UButton: {
            template: '<button><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Clear')
  })
})
