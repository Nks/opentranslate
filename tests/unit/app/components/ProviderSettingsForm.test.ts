// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import { mount } from '@vue/test-utils'
import ProviderSettingsForm from '@app/components/ProviderSettingsForm.vue'
import type {
  ProviderSettingsField,
  ProviderSecretField,
} from '@shared/providers/descriptor'

interface PickFileArgs {
  filters?: readonly {
    name: string
    extensions: string[]
  }[]
}

interface PickFileResult {
  filePath: string | null
  validation?: {
    ok: boolean
    error?: string
  }
}

interface ApiSurface {
  secrets: {
    test: () => Promise<{
      present: boolean
      lastUpdated: string | null
    }>
  }
  settings: {
    pickFile: (args: PickFileArgs & {
      validate?: 'google-service-account'
    }) => Promise<PickFileResult>
  }
}

declare global {

  var pickFileResult: PickFileResult
  var pickFileCalls: Array<PickFileArgs & {
    validate?: 'google-service-account'
  }>
}

beforeEach(() => {
  globalThis.pickFileResult = {
    filePath: '/Users/test/picked.json',
    validation: { ok: true },
  }
  globalThis.pickFileCalls = []
  const api: ApiSurface = {
    secrets: {
      test: async () => ({
        present: false,
        lastUpdated: null,
      }),
    },
    settings: {
      pickFile: async (
        args: PickFileArgs & { validate?: 'google-service-account' },
      ): Promise<PickFileResult> => {
        globalThis.pickFileCalls.push(args)

        return globalThis.pickFileResult
      },
    },
  }
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: api,
  })
})

const FILE_PATH_FIELD: ProviderSettingsField = {
  key: 'credentialsJsonPath',
  label: 'Service account credentials (JSON file)',
  description: 'Pick a service account key file.',
  type: 'file-path',
  required: true,
  group: 'general',
  validate: 'google-service-account',
}

const STUBS = {
  UFormField: {
    props: ['label', 'description', 'error'],
    template:
      '<div class="form-field"><label>{{ label }}</label><slot /><span v-if="error" class="error">{{ error }}</span></div>',
  },
  UInput: {
    props: ['modelValue', 'readonly', 'placeholder', 'type'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" :readonly="readonly" />',
  },
  USwitch: true,
  USelect: true,
  UButton: {
    props: ['icon', 'variant', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}

const NO_SECRETS: readonly ProviderSecretField[] = []

describe('ProviderSettingsForm — file-path field', () => {
  it('renders the current path read-only and shows a Browse button', () => {
    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'google',
        settingsFields: [FILE_PATH_FIELD],
        secretFields: NO_SECRETS,
        currentSettings: { credentialsJsonPath: '/existing/creds.json' },
      },
      global: { stubs: STUBS },
    })

    const input = wrapper.find('input')
    expect(input.attributes('value')).toBe('/existing/creds.json')
    expect(input.attributes('readonly')).toBeDefined()
    expect(wrapper.text()).toContain('Browse')
  })

  it('emits update:field with the picked path when Browse succeeds', async () => {
    globalThis.pickFileResult = {
      filePath: '/Users/test/new-creds.json',
      validation: { ok: true },
    }

    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'google',
        settingsFields: [FILE_PATH_FIELD],
        secretFields: NO_SECRETS,
        currentSettings: { credentialsJsonPath: '' },
      },
      global: { stubs: STUBS },
    })

    await wrapper.find('button').trigger('click')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    const events = wrapper.emitted('update:field')
    expect(events).toBeTruthy()
    expect(events?.[0]).toEqual(['credentialsJsonPath', '/Users/test/new-creds.json'])
  })

  it('surfaces the validation error inline when the picked file is invalid', async () => {
    globalThis.pickFileResult = {
      filePath: '/Users/test/bogus.json',
      validation: {
        ok: false,
        error: 'Missing required key: client_email.',
      },
    }

    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'google',
        settingsFields: [FILE_PATH_FIELD],
        secretFields: NO_SECRETS,
        currentSettings: { credentialsJsonPath: '' },
      },
      global: { stubs: STUBS },
    })

    await wrapper.find('button').trigger('click')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('Missing required key: client_email.')
    expect(wrapper.emitted('update:field')).toBeUndefined()
  })

  it('does nothing when the user cancels the picker', async () => {
    globalThis.pickFileResult = { filePath: null }

    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'google',
        settingsFields: [FILE_PATH_FIELD],
        secretFields: NO_SECRETS,
        currentSettings: { credentialsJsonPath: '/keep/me.json' },
      },
      global: { stubs: STUBS },
    })

    await wrapper.find('button').trigger('click')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('update:field')).toBeUndefined()
  })

  it('forwards field.validate to pickFile (not a key-name match)', async () => {
    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'google',
        settingsFields: [FILE_PATH_FIELD],
        secretFields: NO_SECRETS,
        currentSettings: { credentialsJsonPath: '' },
      },
      global: { stubs: STUBS },
    })
    await wrapper.find('button').trigger('click')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(globalThis.pickFileCalls).toHaveLength(1)
    expect(globalThis.pickFileCalls[0]?.validate).toBe('google-service-account')
  })

  it('omits validate from pickFile call when field declares no validate profile', async () => {
    const unvalidatedField: ProviderSettingsField = {
      key: 'someOtherPath',
      label: 'Some other path',
      type: 'file-path',
      required: false,
      group: 'general',
    }
    const wrapper = mount(ProviderSettingsForm, {
      props: {
        providerId: 'libretranslate',
        settingsFields: [unvalidatedField],
        secretFields: NO_SECRETS,
        currentSettings: { someOtherPath: '' },
      },
      global: { stubs: STUBS },
    })
    await wrapper.find('button').trigger('click')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(globalThis.pickFileCalls).toHaveLength(1)
    expect(globalThis.pickFileCalls[0]?.validate).toBeUndefined()
  })
})
