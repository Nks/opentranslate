import type {
  ProviderId,
} from './provider-id'

export interface HistoryEntry {
  id: string
  sourceText: string
  translatedText: string
  sourceLanguageCode: string
  targetLanguageCode: string
  provider: ProviderId
  createdAt: string
}
