// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import TopBar from '@app/components/TopBar.vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'

const descriptors: ProviderDescriptorDto[] = [
  {
    id: 'google',
    displayName: 'Google',
    description: '',
    settingsFields: [],
    secretFields: [],
  },
]

const languages: Language[] = [
  {
    code: 'en',
    name: 'English',
    providerCode: 'en',
    supportsSource: true,
    supportsTarget: true,
  },
  {
    code: 'de',
    name: 'German',
    providerCode: 'de',
    supportsSource: true,
    supportsTarget: true,
  },
]

const stubs = {
  ProviderSelector: true,
  LanguageSelector: true,
  UButton: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button data-testid="swap" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  UNavigationMenu: true,
  UColorModeButton: true,
  UIcon: true,
}

function makeProps(sourceSelection: SourceLanguageSelection) {
  return {
    providers: descriptors,
    activeProviderId: 'google',
    sourceLanguages: languages,
    targetLanguages: languages,
    sourceSelection,
    targetLanguage: 'de',
  }
}

describe('TopBar swap button', () => {
  it('is disabled when the source is auto-detect', () => {
    const wrapper = mount(TopBar, {
      props: makeProps({ mode: 'auto' }),
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="swap"]').attributes('disabled')).toBeDefined()
  })

  it('is enabled and emits swap when the source is explicit', async () => {
    const wrapper = mount(TopBar, {
      props: makeProps({
        mode: 'explicit',
        code: 'en',
      }),
      global: { stubs },
    })
    const button = wrapper.find('[data-testid="swap"]')

    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('swap')).toHaveLength(1)
  })
})
