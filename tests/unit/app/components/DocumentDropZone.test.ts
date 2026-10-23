// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentDropZone from '@app/components/DocumentDropZone.vue'
import { documentStubs } from './support/nuxt-ui-stubs'

interface ZoneProps {
  disabled: boolean
  dragging: boolean
  fileName: string
}

function mountZone(props: Partial<ZoneProps> = {}) {
  return mount(DocumentDropZone, {
    props: {
      disabled: false,
      dragging: false,
      fileName: '',
      ...props,
    },
    global: { stubs: documentStubs },
  })
}

describe('DocumentDropZone', () => {
  it('invites a drop and offers an explicit picker', async () => {
    const wrapper = mountZone()

    expect(wrapper.text()).toContain('Drop a document here')
    await wrapper.find('button[aria-label="Choose file"]').trigger('click')

    expect(wrapper.emitted('pick')).toHaveLength(1)
  })

  it('shows the selected file name', () => {
    const wrapper = mountZone({ fileName: 'report.pdf' })

    expect(wrapper.find('[aria-label="Selected document"]').text()).toBe('report.pdf')
    expect(wrapper.text()).toContain('Choose another file')
  })

  it('highlights while a file is dragged over the page', () => {
    expect(mountZone({ dragging: true }).classes()).toContain('border-primary')
  })

  it('disables the picker when documents are unavailable', () => {
    const wrapper = mountZone({ disabled: true })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toContain('unavailable')
  })
})
