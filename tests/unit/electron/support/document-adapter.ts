import type {
  DocumentTranslationInput, DocumentTranslationOutput, TranslationProvider,
} from '@shared/providers/contract'

export type TranslateDocumentFn = (
  input: DocumentTranslationInput,
) => Promise<DocumentTranslationOutput>

export const PROVIDER_BYTES_OUTPUT: DocumentTranslationOutput = {
  content: new Uint8Array([0x54, 0x00, 0xff]),
  provider: 'libretranslate',
}
const DEFAULT_FORMATS: readonly string[] = ['.txt', '.pdf']

export function documentAdapter(options: {
  formats?: string[]
  supported?: boolean
  translateDocument?: TranslateDocumentFn
} = {}): TranslationProvider {
  return {
    id: 'libretranslate',
    getHealth: async () => ({ ok: true }),
    getSupportedLanguages: async () => [],
    detectLanguage: async () => ({ detectedLanguage: 'en' }),
    translateText: async () => ({
      translatedText: '',
      provider: 'libretranslate',
    }),
    supportsDocumentTranslation: async (): Promise<boolean> => options.supported ?? true,
    getSupportedDocumentFormats: async (): Promise<string[]> => [
      ...(options.formats ?? DEFAULT_FORMATS),
    ],
    translateDocument: options.translateDocument ??
      (async (): Promise<DocumentTranslationOutput> => PROVIDER_BYTES_OUTPUT),
    getCapabilities: async () => ({
      textTranslation: true,
      languageDetection: true,
      supportedLanguagesDiscovery: true,
      documentTranslation: true,
    }),
  }
}
