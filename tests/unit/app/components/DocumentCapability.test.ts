// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import {
  mount, type VueWrapper,
} from '@vue/test-utils'
import DocumentCapability from '@app/components/DocumentCapability.vue'
import { documentStubs } from './support/nuxt-ui-stubs'

describe('DocumentCapability', () => {
  it('lists the provider formats when documents are supported', () => {
    const wrapper: VueWrapper = mount(DocumentCapability, {
      props: {
        checking: false,
        supported: true,
        message: 'Document translation available',
        formats: ['.txt', '.pdf'],
      },
      global: { stubs: documentStubs },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('Document translation available')
    expect(wrapper.findAll('.badge').map((badge) => badge.text())).toEqual(['.txt', '.pdf'])
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toContain('checkmark-circle')
  })

  it('shows the reason and no formats when unsupported', () => {
    const wrapper: VueWrapper = mount(DocumentCapability, {
      props: {
        checking: false,
        supported: false,
        message: 'Document translation not supported by this provider',
        formats: [],
      },
      global: { stubs: documentStubs },
    })

    expect(wrapper.text()).toContain('not supported by this provider')
    expect(wrapper.findAll('.badge')).toHaveLength(0)
    expect(wrapper.find('[data-icon]').attributes('data-icon')).toContain('warning')
  })

  it('shows a spinner while checking', () => {
    const wrapper: VueWrapper = mount(DocumentCapability, {
      props: {
        checking: true,
        supported: false,
        message: 'Checking provider capability...',
        formats: [],
      },
      global: { stubs: documentStubs },
    })

    expect(wrapper.find('[data-icon]').attributes('data-icon')).toContain('arrow-sync')
  })
})
