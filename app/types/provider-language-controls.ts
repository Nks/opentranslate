import type { ProviderDescriptorDto } from '@shared/providers/descriptor'
import type { Language } from '@shared/types/language'
import type { SourceLanguageSelection } from '@shared/types/translation'

export interface ProviderLanguageControlsProps {
  providers: ProviderDescriptorDto[]
  activeProviderId: string | null
  sourceLanguages: Language[]
  targetLanguages: Language[]
  sourceSelection: SourceLanguageSelection
  targetLanguage: string | null
}

export interface ProviderLanguageControlsEmits {
  switch: [providerId: string]
  'source-change': [code: string | null]
  'target-change': [code: string | null]
}
