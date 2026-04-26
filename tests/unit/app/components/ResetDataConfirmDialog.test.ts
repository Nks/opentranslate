// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import ResetDataConfirmDialog from '@app/components/ResetDataConfirmDialog.vue'

function makeStubs() {
  return {
    UModal: {
      props: ['modelValue', 'open', 'title', 'dismissible', 'close'],
      template: `
        <div data-testid="modal" :data-open="open">
          <h2 data-testid="modal-title">{{ title }}</h2>
          <slot name="body" />
          <slot name="footer" />
        </div>
      `,
    },
    UButton: {
      props: ['disabled', 'loading', 'variant', 'color'],
      template: `
        <button
          :data-variant="variant"
          :data-color="color"
          :data-loading="loading"
          :disabled="disabled"
          @click="$emit('click')"
        ><slot /></button>
      `,
      emits: ['click'],
    },
  }
}

describe('ResetDataConfirmDialog', () => {
  it('renders title, honest body copy, and Cancel/Confirm buttons when open', () => {
    const wrapper = mount(ResetDataConfirmDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const text = wrapper.text()

    expect(text).toContain('Reset all local data')
    expect(text).toMatch(/history/i)
    expect(text).toContain('not affected')
    expect(text).toContain('keychain')
    expect(text).toContain('Cancel')
    expect(text).toContain('Confirm')
  })

  it('emits update:modelValue=false when Cancel is clicked', async () => {
    const wrapper = mount(ResetDataConfirmDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const cancelButton = wrapper
      .findAll('button')
      .find((btn) => btn.text() === 'Cancel')!
    await cancelButton.trigger('click')

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual([false])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits confirm when Confirm is clicked', async () => {
    const wrapper = mount(ResetDataConfirmDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const confirmButton = wrapper
      .findAll('button')
      .find((btn) => btn.text() === 'Confirm')!
    await confirmButton.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('disables Cancel and marks Confirm as loading while loading=true', () => {
    const wrapper = mount(ResetDataConfirmDialog, {
      props: {
        modelValue: true,
        loading: true,
      },
      global: { stubs: makeStubs() },
    })
    const buttons = wrapper.findAll('button')
    const cancelButton = buttons[0]!
    const confirmButton = buttons[1]!

    expect(cancelButton.attributes('disabled')).toBeDefined()
    expect(confirmButton.attributes('data-loading')).toBe('true')
  })
})
