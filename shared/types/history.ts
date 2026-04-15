import type { ProviderId } from './provider-id.js';

export interface HistoryEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  provider: ProviderId;
  createdAt: string;
}
