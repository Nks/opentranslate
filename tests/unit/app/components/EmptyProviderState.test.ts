// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyProviderState from '@app/components/EmptyProviderState.vue'

describe('EmptyProviderState', () => {
  it('invites the user to configure a provider and links to /settings', () => {
    const wrapper = mount(EmptyProviderState, {
      global: {
        stubs: {
          UIcon: true,
          UButton: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Configure a provider to start translating')
    expect(wrapper.find('a').attributes('href')).toBe('/settings')
  })
})
