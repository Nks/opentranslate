// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import {
  mount, type DOMWrapper, type VueWrapper,
} from '@vue/test-utils'
import DocumentTranslateAction from '@app/components/DocumentTranslateAction.vue'
import { documentStubs } from './support/nuxt-ui-stubs'

interface ActionProps {
  canTranslate: boolean
  translating: boolean
  fileName: string
  targetLabel: string | null
  blockedReason: string | null
}

function mountAction(props: Partial<ActionProps> = {}): VueWrapper {
  return mount(DocumentTranslateAction, {
    props: {
      canTranslate: true,
      translating: false,
      fileName: 'notes.txt',
      targetLabel: 'Russian',
      blockedReason: null,
      ...props,
    },
    global: { stubs: documentStubs },
  })
}

describe('DocumentTranslateAction', () => {
  it('names the target language and emits translate', async () => {
    const wrapper: VueWrapper = mountAction()
    const button: DOMWrapper<Element> = wrapper.find('button[aria-label="Translate document"]')

    expect(button.text()).toBe('Translate to Russian')
    await button.trigger('click')

    expect(wrapper.emitted('translate')).toHaveLength(1)
  })

  it('shows progress and disables the button while translating', () => {
    const wrapper: VueWrapper = mountAction({
      canTranslate: false,
      translating: true,
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="progress"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').text()).toBe('Translating notes.txt to Russian…')
  })

  it('explains why translation is blocked', () => {
    const wrapper: VueWrapper = mountAction({
      canTranslate: false,
      blockedReason: 'Select a target language.',
      targetLabel: null,
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').text()).toBe('Translate')
    expect(wrapper.text()).toContain('Select a target language.')
  })
})
