// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import {
  mount, flushPromises,
} from '@vue/test-utils'
import ShortcutRecorder from '@app/components/ShortcutRecorder.vue'

function pressKey(
  key: string,
  modifiers: {
    metaKey?: boolean
    ctrlKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
  } = {},
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    altKey: modifiers.altKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
}

describe('ShortcutRecorder', () => {
  it('renders the current accelerator as a platform-aware glyph on macOS', () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'CommandOrControl+C+C',
        platform: 'darwin',
      },
    })

    expect(wrapper.text()).toContain('⌘+C+C')
  })

  it('renders the current accelerator as Ctrl+C+C on Windows', () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'CommandOrControl+C+C',
        platform: 'win32',
      },
    })

    expect(wrapper.text()).toContain('Ctrl+C+C')
  })

  it('shows the recording prompt after the field is clicked', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Press shortcut')
  })

  it('emits update:modelValue with a Ctrl+T+T chord when Ctrl+T is pressed', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')

    pressKey('t', { ctrlKey: true })
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toBe('Ctrl+T+T')
  })

  it('emits an error when a key is pressed without any modifier', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')

    pressKey('a')
    await flushPromises()

    const errors = wrapper.emitted('error')
    expect(errors).toBeTruthy()
    expect(errors?.[0]?.[0]).toMatch(/at least one modifier/i)
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('ignores modifier-only keydowns while recording', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')

    pressKey('Meta', { metaKey: true })
    pressKey('Shift', { shiftKey: true })
    pressKey('Control', { ctrlKey: true })
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    expect(wrapper.text()).toContain('Press shortcut')
  })

  it('cancels recording when Escape is pressed', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Press shortcut')

    pressKey('Escape')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    expect(wrapper.text()).not.toContain('Press shortcut')
  })

  it('emits an empty string when Clear is clicked', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    const buttons = wrapper.findAll('button')
    const clearButton = buttons.find((btn) => btn.text() === 'Clear')
    expect(clearButton).toBeDefined()

    await clearButton!.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]?.[0]).toBe('')
  })

  it('captures Cmd+K on macOS as Meta+K+K', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'CommandOrControl+C+C',
        platform: 'darwin',
      },
    })
    await wrapper.find('button').trigger('click')

    pressKey('k', { metaKey: true })
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]?.[0]).toBe('Meta+K+K')
  })

  it('falls back to the raw string when modelValue is malformed', () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'not-a-valid-accelerator',
        platform: 'linux',
      },
    })

    expect(wrapper.text()).toContain('not-a-valid-accelerator')
  })

  it('resets the recording state when modelValue changes externally', async () => {
    const wrapper = mount(ShortcutRecorder, {
      props: {
        modelValue: 'Ctrl+C+C',
        platform: 'linux',
      },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Press shortcut')

    await wrapper.setProps({
      modelValue: 'Ctrl+T+T',
      platform: 'linux',
    } as Record<string, unknown>)
    expect(wrapper.text()).not.toContain('Press shortcut')
  })
})
