// @vitest-environment happy-dom
import {
  describe, expect, it,
} from 'vitest'
import {
  mount, type VueWrapper,
} from '@vue/test-utils'
import ProviderLanguageControls from '@app/components/ProviderLanguageControls.vue'
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'
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

function mountControls(sourceSelection: SourceLanguageSelection): VueWrapper {
  return mount(ProviderLanguageControls, {
    props: {
      providers,
      activeProviderId: 'libretranslate',
      sourceLanguages: languages,
      targetLanguages: languages,
      sourceSelection,
      targetLanguage: 'ru',
    },
    slots: {
      between: '<span data-testid="between" />',
    },
    global: {
      stubs: {
        ProviderSelector: providerSelectorStub,
        LanguageSelector: languageSelectorStub,
      },
    },
  })
}

describe('ProviderLanguageControls', () => {
  it('renders provider, source (with Auto Detect) and target selectors with the slot between them', () => {
    const wrapper: VueWrapper = mountControls({ mode: 'auto' })
    const order: string[] = wrapper.findAll('select, span').map(
      (element): string => element.attributes('aria-label') ?? element.attributes('data-testid') ?? '',
    )

    expect(order).toEqual(['provider', 'Source language', 'between', 'Target language'])
    expect(wrapper.find('[aria-label="Source language"]').attributes('data-auto')).toBe('true')
    expect(wrapper.find('[aria-label="Target language"]').attributes('data-value')).toBe('ru')
  })

  it('passes an explicit source code to the source selector', () => {
    const wrapper: VueWrapper = mountControls({
      mode: 'explicit',
      code: 'en',
    })

    expect(wrapper.find('[aria-label="Source language"]').attributes('data-value')).toBe('en')
  })

  it('re-emits provider and language changes', async () => {
    const wrapper: VueWrapper = mountControls({ mode: 'auto' })

    await wrapper.find('[data-testid="provider"]').trigger('change')
    await wrapper.find('[aria-label="Source language"]').trigger('change')
    await wrapper.find('[aria-label="Target language"]').trigger('change')

    expect(wrapper.emitted('switch')).toEqual([['libretranslate']])
    expect(wrapper.emitted('source-change')).toEqual([['en']])
    expect(wrapper.emitted('target-change')).toEqual([['en']])
  })
})
