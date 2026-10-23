// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentsHeader from '@app/components/DocumentsHeader.vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'
import { documentStubs } from './support/nuxt-ui-stubs'

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

const stubs = {
  ...documentStubs,
  ProviderSelector: {
    props: ['providers', 'activeId'],
    emits: ['switch'],
    template: '<select data-testid="provider" :data-active="activeId" @change="$emit(\'switch\', \'libretranslate\')" />',
  },
  LanguageSelector: {
    props: ['languages', 'modelValue', 'label', 'autoDetectOption'],
    emits: ['update:modelValue'],
    template: '<select :aria-label="label" :data-value="modelValue" :data-auto="autoDetectOption" @change="$emit(\'update:modelValue\', \'en\')" />',
  },
}

function mountHeader(sourceSelection: SourceLanguageSelection) {
  return mount(DocumentsHeader, {
    props: {
      providers,
      activeProviderId: 'libretranslate',
      sourceLanguages: languages,
      targetLanguages: languages,
      sourceSelection,
      targetLanguage: 'ru',
    },
    global: { stubs },
  })
}

describe('DocumentsHeader', () => {
  it('renders the provider selector and both language selectors', () => {
    const wrapper = mountHeader({ mode: 'auto' })

    expect(wrapper.find('[data-testid="provider"]').attributes('data-active')).toBe('libretranslate')
    expect(wrapper.find('[aria-label="Source language"]').attributes('data-auto')).toBe('true')
    expect(wrapper.find('[aria-label="Target language"]').attributes('data-value')).toBe('ru')
  })

  it('passes the explicit source code to the source selector', () => {
    const wrapper = mountHeader({
      mode: 'explicit',
      code: 'en',
    })

    expect(wrapper.find('[aria-label="Source language"]').attributes('data-value')).toBe('en')
  })

  it('re-emits provider and language changes', async () => {
    const wrapper = mountHeader({ mode: 'auto' })

    await wrapper.find('[data-testid="provider"]').trigger('change')
    await wrapper.find('[aria-label="Source language"]').trigger('change')
    await wrapper.find('[aria-label="Target language"]').trigger('change')

    expect(wrapper.emitted('switch')).toEqual([['libretranslate']])
    expect(wrapper.emitted('source-change')).toEqual([['en']])
    expect(wrapper.emitted('target-change')).toEqual([['en']])
  })
})
