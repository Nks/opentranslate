import type { Language } from '../types/language.js';
import type { ProviderCapabilities } from '../types/capabilities.js';
import type { ProviderId } from '../types/provider-id.js';
import type { HealthStatus } from '../types/health.js';
import type {
  LanguageDetectionResult,
  SourceLanguageSelection,
  TranslationInput,
  TranslationOutput,
} from '../types/translation.js';

export interface DocumentTranslationInput {
  sourcePath: string;
  sourceLanguage: SourceLanguageSelection;
  targetLanguage: string;
  timeoutMs?: number;
}

export interface DocumentTranslationOutput {
  outputPath: string;
  provider: ProviderId;
  rawMetadata?: Record<string, unknown>;
}

export interface TranslationProvider {
  readonly id: ProviderId;
  getHealth(): Promise<HealthStatus>;
  getSupportedLanguages(): Promise<Language[]>;
  detectLanguage(text: string): Promise<LanguageDetectionResult>;
  translateText(input: TranslationInput): Promise<TranslationOutput>;
  supportsDocumentTranslation(): Promise<boolean>;
  translateDocument?(input: DocumentTranslationInput): Promise<DocumentTranslationOutput>;
  getCapabilities(): Promise<ProviderCapabilities>;
}

export type {
  Language,
  ProviderCapabilities,
  ProviderId,
  HealthStatus,
  TranslationInput,
  TranslationOutput,
  LanguageDetectionResult,
};
