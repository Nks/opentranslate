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

export interface DocumentTranslationInput {
  sourcePath: string
  sourceLanguage: SourceLanguageSelection
  targetLanguage: string
  timeoutMs?: number
}

export interface DocumentTranslationOutput {
  outputPath: string
  provider: ProviderId
  rawMetadata?: Record<string, unknown>
}

export interface TranslationProvider {
  readonly id: ProviderId
  getHealth(): Promise<HealthStatus>
  getSupportedLanguages(): Promise<Language[]>
  detectLanguage(text: string): Promise<LanguageDetectionResult>
  translateText(input: TranslationInput): Promise<TranslationOutput>
  supportsDocumentTranslation(): Promise<boolean>
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
