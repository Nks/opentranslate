// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBar from '@app/components/StatusBar.vue'

describe('StatusBar', () => {
  it('shows Ready when not loading and no error', () => {
    const wrapper = mount(StatusBar, {
      props: {
        loading: false, error: null,
      },
      global: {
        stubs: {
          UIcon: true, UButton: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Ready')
  })

  it('shows error message when error is set', () => {
    const wrapper = mount(StatusBar, {
      props: {
        loading: false, error: 'Network failed',
      },
      global: {
        stubs: {
          UIcon: true,
          UButton: {
            template: '<button><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Network failed')
    expect(wrapper.text()).toContain('Retry')
  })

  it('emits retry when retry button is clicked', async () => {
    const wrapper = mount(StatusBar, {
      props: {
        loading: false, error: 'failed',
      },
      global: {
        stubs: {
          UIcon: true,
          UButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
        },
      },
    })
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('retry')).toBeTruthy()
  })
})
