import {
  defineStore,
} from 'pinia'
import type {
  ProviderDescriptorDto,
} from '@shared/providers/descriptor'
import type {
  Language,
} from '@shared/types/language'
import type {
  ProviderCapabilities,
} from '@shared/types/capabilities'
import type {
  SourceLanguageSelection,
} from '@shared/types/translation'
import type {
  ActiveProviderSelection,
} from '@shared/types/settings'

export const useProvidersStore = defineStore('providers', {
  state: () => ({
    descriptors: [] as ProviderDescriptorDto[],
    activeProviderId: null as string | null,
    languages: [] as Language[],
    capabilities: null as ProviderCapabilities | null,
    sourceSelection: {
      mode: 'auto',
    } as SourceLanguageSelection,
    targetLanguage: null as string | null,
    loading: false,
    error: null as string | null,
  }),
  getters: {
    sourceLanguages: (state) => state.languages.filter((lang) => lang.supportsSource),
    targetLanguages: (state) => state.languages.filter((lang) => lang.supportsTarget),
    activeDescriptor: (state) =>
      state.descriptors.find((desc) => desc.id === state.activeProviderId) ?? null,
    currentSelection(): ActiveProviderSelection {
      return {
        providerId: this.activeProviderId,
        sourceSelection: this.sourceSelection,
        targetLanguage: this.targetLanguage,
      }
    },
  },
  actions: {
    hydrateFromSelection(selection: ActiveProviderSelection): void {
      const candidate = selection.providerId
      const isKnown = candidate !== null &&
        this.descriptors.some((desc) => desc.id === candidate)

      this.activeProviderId = isKnown ? candidate : null
      this.sourceSelection = selection.sourceSelection
      this.targetLanguage = selection.targetLanguage
    },
  },
})
