// @vitest-environment happy-dom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { mount } from '@vue/test-utils'
import {
  createPinia,
  setActivePinia,
} from 'pinia'
import SettingsShortcutsTab from '@app/components/SettingsShortcutsTab.vue'
import ShortcutRecorder from '@app/components/ShortcutRecorder.vue'
import type { ShortcutsSettings } from '@shared/types/settings'

const toastAdd = vi.fn()

/**
 * `useToast` is a Nuxt UI auto-import that exists as a bare global at
 * runtime. In vitest we stub it on `globalThis` so the component's toast
 * path works without a Nuxt context.
 */
beforeEach(() => {
  ;(globalThis as Record<string, unknown>).useToast = () => ({
    add: toastAdd,
  })
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.clearAllMocks()
  delete (globalThis as Record<string, unknown>).useToast
})

function makeShortcuts(overrides: Partial<ShortcutsSettings> = {}): ShortcutsSettings {
  return {
    quickTranslate: 'Ctrl+C+C',
    openMain: 'CommandOrControl+Shift+T',
    quickTranslateEnabled: true,
    ...overrides,
  }
}

function mountTab(shortcuts: ShortcutsSettings, platform = 'linux') {
  return mount(SettingsShortcutsTab, {
    props: {
      shortcuts,
      platform,
    },
    global: {
      components: {
        ShortcutRecorder,
      },
      stubs: {
        UFormField: {
          template: '<div><slot /></div>',
        },
        USwitch: {
          template: '<input type="checkbox" :checked="modelValue" @change="onChange" />',
          props: ['modelValue'],
          emits: ['update:model-value'],
          methods: {
            onChange(event: Event) {
              const target = event.target as HTMLInputElement

              this.$emit('update:model-value', target.checked)
            },
          },
        },
      },
    },
  })
}

describe('SettingsShortcutsTab', () => {
  it('renders the current quick-translate shortcut through ShortcutRecorder', () => {
    const wrapper = mountTab(makeShortcuts({ quickTranslate: 'Ctrl+T+T' }))

    expect(wrapper.text()).toContain('Ctrl+T+T')
  })

  it('emits update:shortcuts with merged payload when the recorder emits a new value', async () => {
    const shortcuts = makeShortcuts()
    const wrapper = mountTab(shortcuts)

    const recorder = wrapper.findComponent(ShortcutRecorder)
    recorder.vm.$emit('update:modelValue', 'Meta+K+K')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:shortcuts')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toEqual({
      ...shortcuts,
      quickTranslate: 'Meta+K+K',
    })
  })

  it('does not emit update:shortcuts when the recorder emits an empty value', async () => {
    const shortcuts = makeShortcuts()
    const wrapper = mountTab(shortcuts)

    const recorder = wrapper.findComponent(ShortcutRecorder)
    recorder.vm.$emit('update:modelValue', '')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:shortcuts')).toBeFalsy()
    expect(toastAdd).toHaveBeenCalledOnce()
  })

  it('emits update:shortcuts with the toggled enabled flag', async () => {
    const shortcuts = makeShortcuts({ quickTranslateEnabled: true })
    const wrapper = mountTab(shortcuts)

    const toggle = wrapper.find('input[type="checkbox"]')
    expect(toggle.exists()).toBe(true)

    await toggle.setValue(false)

    const emitted = wrapper.emitted('update:shortcuts')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toEqual({
      ...shortcuts,
      quickTranslateEnabled: false,
    })
  })

  it('passes the platform prop through to ShortcutRecorder so darwin glyphs render', () => {
    const wrapper = mountTab(
      makeShortcuts({ quickTranslate: 'CommandOrControl+C+C' }),
      'darwin',
    )

    expect(wrapper.text()).toContain('⌘+C+C')
  })

  it('surfaces recorder errors through the toast handler', async () => {
    const wrapper = mountTab(makeShortcuts())
    const recorder = wrapper.findComponent(ShortcutRecorder)
    recorder.vm.$emit('error', 'needs modifier')
    await wrapper.vm.$nextTick()

    expect(toastAdd).toHaveBeenCalledOnce()
    const payload = toastAdd.mock.calls[0]![0] as { description?: string }
    expect(payload.description).toContain('needs modifier')
  })
})
