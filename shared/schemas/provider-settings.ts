import { z } from 'zod';
import type {
  GoogleProviderSettings,
  LibreTranslateProviderSettings,
} from '../types/provider-settings.js';

const googleEditionSchema = z.enum(['basic', 'advanced']);

export const googleProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  projectId: z.string(),
  credentialsJsonPath: z.string(),
  edition: googleEditionSchema,
  location: z.string().nullable(),
  requestTimeoutMs: z.number().int().positive(),
});

export const libreTranslateProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  endpoint: z
    .string()
    .url()
    .refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
      message: 'endpoint must use http or https',
    }),
  apiKey: z.string().min(1).nullable(),
  requestTimeoutMs: z.number().int().positive(),
  allowSelfSignedTls: z.boolean(),
});

export const defaultGoogleProviderSettings: GoogleProviderSettings = {
  enabled: false,
  projectId: '',
  credentialsJsonPath: '',
  edition: 'basic',
  location: null,
  requestTimeoutMs: 15_000,
};

export const defaultLibreTranslateProviderSettings: LibreTranslateProviderSettings = {
  enabled: false,
  endpoint: 'https://libretranslate.com',
  apiKey: null,
  requestTimeoutMs: 15_000,
  allowSelfSignedTls: false,
};
