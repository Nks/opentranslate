import type {
  Language,
} from '@shared/types/language'
import type {
  ProviderCapabilities,
} from '@shared/types/capabilities'
import type {
  ProviderId,
} from '@shared/types/provider-id'
import type {
  HealthStatus,
} from '@shared/types/health'
import type {
  LanguageDetectionResult,
  SourceLanguageSelection,
  TranslationInput,
  TranslationOutput,
} from '@shared/types/translation'

/** Raw document bytes backed by a non-shared `ArrayBuffer` (valid `BlobPart`). */
export type DocumentBytes = Uint8Array<ArrayBuffer>

/**
 * Document handed to an adapter. The main-process document service owns all
 * file I/O and path validation; adapters only see the file name and bytes.
 */
export interface DocumentTranslationInput {
  fileName: string
  content: DocumentBytes
  sourceLanguage: SourceLanguageSelection
  targetLanguage: string
}

/** Provider-returned bytes, saved by the document service without modification. */
export interface DocumentTranslationOutput {
  content: DocumentBytes
  provider: ProviderId
}

export interface TranslationProvider {
  readonly id: ProviderId
  getHealth(): Promise<HealthStatus>
  getSupportedLanguages(): Promise<Language[]>
  detectLanguage(text: string): Promise<LanguageDetectionResult>
  translateText(input: TranslationInput): Promise<TranslationOutput>
  supportsDocumentTranslation(): Promise<boolean>
  getSupportedDocumentFormats?(): Promise<string[]>
  translateDocument?(input: DocumentTranslationInput): Promise<DocumentTranslationOutput>
  getCapabilities(): Promise<ProviderCapabilities>
}

export type {
  Language,
  ProviderCapabilities,
  ProviderId,
  HealthStatus,
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
}
