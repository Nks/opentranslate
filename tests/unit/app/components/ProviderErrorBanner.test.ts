// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import ProviderErrorBanner from '@app/components/ProviderErrorBanner.vue'

describe('ProviderErrorBanner', () => {
  const stubs = {
    UIcon: true,
    UButton: {
      template: '<button type="button"><slot /></button>',
    },
  }

  it('renders nothing when error is null', () => {
    const wrapper = mount(ProviderErrorBanner, {
      props: { error: null },
      global: { stubs },
    })

    expect(wrapper.find('pre').exists()).toBe(false)
  })

  it('renders the error message when error is a string', () => {
    const wrapper = mount(ProviderErrorBanner, {
      props: { error: 'Provider unreachable' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Provider unreachable')
  })

  it('emits dismiss when the dismiss button is clicked', async () => {
    const wrapper = mount(ProviderErrorBanner, {
      props: { error: 'Provider unreachable' },
      global: { stubs },
    })
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
