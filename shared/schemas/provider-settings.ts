import {
  z,
} from 'zod'
import type {
  GoogleProviderSettings,
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'

const googleEditionSchema = z.enum(['basic', 'advanced'])
const googleAuthModeSchema = z.enum(['service-account', 'api-key'])

export const googleProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  authMode: googleAuthModeSchema,
  projectId: z.string(),
  credentialsJsonPath: z.string(),
  apiKey: z.string().min(1).nullable(),
  edition: googleEditionSchema,
  location: z.string().nullable(),
  requestTimeoutMs: z.number().int().positive(),
})

export const libreTranslateProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  endpoint: z
    .string()
    .url()
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: 'endpoint must use http or https',
    }),
  apiKey: z.string().min(1).nullable(),
  requestTimeoutMs: z.number().int().positive(),
  allowSelfSignedTls: z.boolean(),
})

export const defaultGoogleProviderSettings: GoogleProviderSettings = {
  enabled: false,
  authMode: 'service-account',
  projectId: '',
  credentialsJsonPath: '',
  apiKey: null,
  edition: 'basic',
  location: null,
  requestTimeoutMs: 15_000,
}

export const defaultLibreTranslateProviderSettings: LibreTranslateProviderSettings = {
  enabled: false,
  endpoint: 'https://libretranslate.com',
  apiKey: null,
  requestTimeoutMs: 15_000,
  allowSelfSignedTls: false,
}
