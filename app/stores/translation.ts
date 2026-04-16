import {
  defineStore,
} from 'pinia'

export const useTranslationStore = defineStore('translation', {
  state: () => ({
    sourceText: '',
    translatedText: '',
    detectedSourceLanguage: null as string | null,
    loading: false,
    error: null as string | null,
  }),
})
