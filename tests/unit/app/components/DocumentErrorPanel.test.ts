// @vitest-environment happy-dom
import {
  describe, expect, it, vi,
} from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentErrorPanel from '@app/components/DocumentErrorPanel.vue'
import { ErrorCategory } from '@shared/errors'
import { documentStubs } from './support/nuxt-ui-stubs'

const copyMock = vi.fn<(value: string) => Promise<void>>(async () => undefined)

vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({
    copy: copyMock,
    copied: { value: false },
  }),
}))

const ERROR = {
  short: 'This file type is not supported for translation. Supported formats: .txt',
  detail: '[unsupported_document_type] AppError: document: unsupported file type ".pdf" — Supported formats: .txt',
  category: ErrorCategory.UnsupportedDocumentType,
}

describe('DocumentErrorPanel', () => {
  it('shows the normalized message and category', () => {
    const wrapper = mount(DocumentErrorPanel, {
      props: { error: ERROR },
      global: { stubs: documentStubs },
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain(ERROR.short)
    expect(wrapper.find('[aria-label="Error category"]').text()).toBe('Unsupported document type')
    expect(wrapper.find('pre').exists()).toBe(false)
  })

  it('reveals and copies the details on demand', async () => {
    const wrapper = mount(DocumentErrorPanel, {
      props: { error: ERROR },
      global: { stubs: documentStubs },
    })

    await wrapper.find('button[aria-label="Show error details"]').trigger('click')
    expect(wrapper.find('pre').text()).toBe(ERROR.detail)

    await wrapper.find('button[aria-label="Copy error details"]').trigger('click')
    expect(copyMock).toHaveBeenCalledWith(ERROR.detail)
  })

  it('emits dismiss', async () => {
    const wrapper = mount(DocumentErrorPanel, {
      props: { error: ERROR },
      global: { stubs: documentStubs },
    })

    await wrapper.find('button[aria-label="Dismiss error"]').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
