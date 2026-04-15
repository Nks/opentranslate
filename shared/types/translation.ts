import type { ProviderId } from './provider-id.js';

export type SourceLanguageSelection = { mode: 'auto' } | { mode: 'explicit'; code: string };

export interface TranslationInput {
  text: string;
  source: SourceLanguageSelection;
  targetLanguage: string;
  format?: 'text';
  timeoutMs?: number;
}

export interface TranslationOutput {
  translatedText: string;
  detectedSourceLanguage?: string;
  provider: ProviderId;
  rawMetadata?: Record<string, unknown>;
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence?: number;
}
