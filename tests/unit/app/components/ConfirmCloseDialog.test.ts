// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmCloseDialog from '@app/components/ConfirmCloseDialog.vue'

function makeStubs() {
  return {
    UModal: {
      props: ['open', 'title', 'dismissible', 'close'],
      emits: ['update:open'],
      template: `
        <div
          data-testid="modal"
          :data-open="open"
        >
          <h2 data-testid="modal-title">{{ title }}</h2>
          <button
            data-testid="modal-dismiss"
            @click="$emit('update:open', false)"
          >
            x
          </button>
          <slot name="body" />
          <slot name="footer" />
        </div>
      `,
    },
    UButton: {
      props: ['disabled', 'loading', 'variant', 'color', 'icon'],
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
    UCheckbox: {
      props: ['modelValue', 'label'],
      template: `
        <label data-testid="remember-checkbox" :data-checked="modelValue">
          <input
            type="checkbox"
            :checked="modelValue"
            @change="$emit('update:modelValue', !modelValue)"
          />
          <span>{{ label }}</span>
        </label>
      `,
      emits: ['update:modelValue'],
    },
  }
}

describe('ConfirmCloseDialog', () => {
  it('renders both choice buttons and the remember checkbox when open', () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const text = wrapper.text()

    expect(text).toMatch(/hide to tray/i)
    expect(text).toMatch(/quit/i)
    expect(text).toMatch(/remember/i)
  })

  it('emits choose with choice=hide and the current remember flag', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const hideButton = wrapper
      .findAll('button')
      .find((btn) => /hide to tray/i.test(btn.text()))!

    await hideButton.trigger('click')

    const events = wrapper.emitted('choose')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual([
      {
        choice: 'hide',
        remember: false,
      },
    ])
  })

  it('emits choose with choice=quit when Quit is clicked', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const quitButton = wrapper
      .findAll('button')
      .find((btn) => /^quit$/i.test(btn.text().trim()))!

    await quitButton.trigger('click')

    const events = wrapper.emitted('choose')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual([
      {
        choice: 'quit',
        remember: false,
      },
    ])
  })

  it('toggling remember updates emitted payload remember flag', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const checkbox = wrapper.find('input[type=\'checkbox\']')
    await checkbox.trigger('change')

    const hideButton = wrapper
      .findAll('button')
      .find((btn) => /hide to tray/i.test(btn.text()))!
    await hideButton.trigger('click')

    const events = wrapper.emitted('choose')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual([
      {
        choice: 'hide',
        remember: true,
      },
    ])
  })

  it('does not emit update:modelValue=false when a choice is made (parent closes)', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const hideButton = wrapper
      .findAll('button')
      .find((btn) => /hide to tray/i.test(btn.text()))!
    await hideButton.trigger('click')

    expect(wrapper.emitted('choose')).toBeTruthy()
  })

  it('emits choose with choice=cancel when the modal is dismissed without a button click', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const dismiss = wrapper.find('[data-testid="modal-dismiss"]')
    await dismiss.trigger('click')

    const events = wrapper.emitted('choose')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual([
      {
        choice: 'cancel',
        remember: false,
      },
    ])
  })

  it('does not emit cancel when the modal closes after a button-click choice', async () => {
    const wrapper = mount(ConfirmCloseDialog, {
      props: { modelValue: true },
      global: { stubs: makeStubs() },
    })
    const hideButton = wrapper
      .findAll('button')
      .find((btn) => /hide to tray/i.test(btn.text()))!
    await hideButton.trigger('click')

    const dismiss = wrapper.find('[data-testid="modal-dismiss"]')
    await dismiss.trigger('click')

    const events = wrapper.emitted('choose')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events?.[0]?.[0]).toMatchObject({ choice: 'hide' })
  })
})
