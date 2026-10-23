// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import {
  mount, type VueWrapper,
} from '@vue/test-utils'
import type { Component } from 'vue'
import DocumentsHeader from '@app/components/DocumentsHeader.vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'
import ProviderLanguageControls from '@app/components/ProviderLanguageControls.vue'
import { documentStubs } from './support/nuxt-ui-stubs'
import {
  languageSelectorStub, providerSelectorStub,
} from './support/selector-stubs'

const providers: ProviderDescriptorDto[] = [
  {
    id: 'libretranslate',
    displayName: 'LibreTranslate',
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
]

const stubs: Record<string, Component> = {
  ...documentStubs,
  ProviderSelector: providerSelectorStub,
  LanguageSelector: languageSelectorStub,
}

function mountHeader(sourceSelection: SourceLanguageSelection): VueWrapper {
  return mount(DocumentsHeader, {
    props: {
      providers,
      activeProviderId: 'libretranslate',
      sourceLanguages: languages,
      targetLanguages: languages,
      sourceSelection,
      targetLanguage: 'ru',
    },
    global: {
      stubs,
      components: { ProviderLanguageControls },
    },
  })
}

describe('DocumentsHeader', () => {
  it('renders the provider selector and both language selectors', () => {
    const wrapper: VueWrapper = mountHeader({ mode: 'auto' })

    expect(wrapper.find('[data-testid="provider"]').attributes('data-active')).toBe('libretranslate')
    expect(wrapper.find('[aria-label="Source language"]').attributes('data-auto')).toBe('true')
    expect(wrapper.find('[aria-label="Target language"]').attributes('data-value')).toBe('ru')
  })

  it('passes the explicit source code to the source selector', () => {
    const wrapper: VueWrapper = mountHeader({
      mode: 'explicit',
      code: 'en',
    })

    expect(wrapper.find('[aria-label="Source language"]').attributes('data-value')).toBe('en')
  })

  it('re-emits provider and language changes', async () => {
    const wrapper: VueWrapper = mountHeader({ mode: 'auto' })

    await wrapper.find('[data-testid="provider"]').trigger('change')
    await wrapper.find('[aria-label="Source language"]').trigger('change')
    await wrapper.find('[aria-label="Target language"]').trigger('change')

    expect(wrapper.emitted('switch')).toEqual([['libretranslate']])
    expect(wrapper.emitted('source-change')).toEqual([['en']])
    expect(wrapper.emitted('target-change')).toEqual([['en']])
  })
})
