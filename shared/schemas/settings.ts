import {
  z,
} from 'zod'
import {
  PROVIDER_IDS,
} from '@shared/types/provider-id'
import type {
  AppSettings,
} from '@shared/types/settings'

const themeSchema = z.enum(['system', 'light', 'dark'])
const retentionSchema = z.enum(['forever', 'last-30-days', 'last-100-entries'])
const providerIdSchema = z.enum(PROVIDER_IDS)

const shortcutsSchema = z.object({
  quickTranslate: z.string().min(1),
  openMain: z.string().min(1),
  quickTranslateEnabled: z.boolean(),
})

const advancedSchema = z.object({
  requestTimeoutMs: z.number().int().positive(),
  libreAllowSelfSignedTls: z.boolean(),
})

export const appSettingsSchema = z.object({
  launchAtStartup: z.boolean(),
  theme: themeSchema,
  defaultTargetLanguage: z.string().min(1).nullable(),
  debounceMs: z.number().int().min(0).max(5_000),
  historyEnabled: z.boolean(),
  historyRetentionMode: retentionSchema,
  shortcuts: shortcutsSchema,
  advanced: advancedSchema,
  activeProvider: providerIdSchema,
})

export const defaultAppSettings: AppSettings = {
  launchAtStartup: false,
  theme: 'system',
  defaultTargetLanguage: null,
  debounceMs: 350,
  historyEnabled: true,
  historyRetentionMode: 'forever',
  shortcuts: {
    quickTranslate: 'CommandOrControl+C+C',
    openMain: 'CommandOrControl+Shift+T',
    quickTranslateEnabled: true,
  },
  advanced: {
    requestTimeoutMs: 15_000,
    libreAllowSelfSignedTls: false,
  },
  activeProvider: 'libretranslate',
}
