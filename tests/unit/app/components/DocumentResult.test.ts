// @vitest-environment happy-dom
import {
  describe, expect, it, vi, type Mock,
} from 'vitest'
import {
  mount, type VueWrapper,
} from '@vue/test-utils'
import DocumentResult from '@app/components/DocumentResult.vue'
import { documentStubs } from './support/nuxt-ui-stubs'

type CopyFn = (value: string) => Promise<void>
const copyMock: Mock<CopyFn> = vi.fn<CopyFn>(async () => undefined)

vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({
    copy: copyMock,
    copied: { value: false },
  }),
}))

describe('DocumentResult', () => {
  it('shows the saved path, reveals through an event and copies the path', async () => {
    const wrapper: VueWrapper = mount(DocumentResult, {
      props: { outputPath: '/docs/notes.ru.translated.txt' },
      global: { stubs: documentStubs },
    })

    expect(wrapper.text()).toContain('/docs/notes.ru.translated.txt')
    await wrapper.find('button[aria-label="Show in folder"]').trigger('click')
    await wrapper.find('button[aria-label="Copy output path"]').trigger('click')

    expect(wrapper.emitted('reveal')).toHaveLength(1)
    expect(copyMock).toHaveBeenCalledWith('/docs/notes.ru.translated.txt')
  })
})
