import {
  z,
} from 'zod'
import {
  TARGET_HISTORY_MAX,
  type AppSettings,
} from '@shared/types/settings'
import {
  DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
  validateQuickTranslateShortcut,
} from '@shared/shortcuts/quick-translate'

const themeSchema = z.enum(['system', 'light', 'dark'])
const retentionSchema = z.enum(['forever', 'last-30-days', 'last-100-entries'])
const closeBehaviorSchema = z.enum(['ask', 'hide', 'quit'])

const quickTranslateAcceleratorSchema = z
  .string()
  .min(1)
  .refine(
    (value: string): boolean => validateQuickTranslateShortcut(value, 'linux').length === 0,
    { message: 'Invalid quick-translate shortcut accelerator' },
  )

const shortcutsSchema = z.object({
  quickTranslate: quickTranslateAcceleratorSchema,
  openMain: z.string().min(1),
  quickTranslateEnabled: z.boolean(),
})

const advancedSchema = z.object({
  requestTimeoutMs: z.number().int().positive(),
})

const sourceSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('auto'),
  }),
  z.object({
    mode: z.literal('explicit'),
    code: z.string().min(1),
  }),
])

export const activeProviderSelectionSchema = z.object({
  providerId: z.string().min(1).nullable(),
  sourceSelection: sourceSelectionSchema,
  targetLanguage: z.string().min(1).nullable(),
})

const targetHistorySchema = z
  .array(z.string().min(1))
  .transform((values: string[]): string[] => {
    const deduped: string[] = []

    for (const entry of values) {
      if (!deduped.includes(entry)) {
        deduped.push(entry)
      }

      if (deduped.length >= TARGET_HISTORY_MAX) {
        break
      }
    }

    return deduped
  })

export const appSettingsSchema = z.object({
  launchAtStartup: z.boolean(),
  theme: themeSchema,
  defaultTargetLanguage: z.string().min(1).nullable(),
  debounceMs: z.number().int().min(0).max(5_000),
  historyEnabled: z.boolean(),
  historyRetentionMode: retentionSchema,
  showTray: z.boolean(),
  closeBehavior: closeBehaviorSchema,
  shortcuts: shortcutsSchema,
  advanced: advancedSchema,
  activeProvider: activeProviderSelectionSchema,
  targetHistory: targetHistorySchema,
})

export const defaultAppSettings: AppSettings = {
  launchAtStartup: false,
  theme: 'system',
  defaultTargetLanguage: null,
  debounceMs: 350,
  historyEnabled: true,
  historyRetentionMode: 'forever',
  showTray: true,
  closeBehavior: 'ask',
  shortcuts: {
    quickTranslate: DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
    openMain: 'CommandOrControl+Shift+T',
    quickTranslateEnabled: true,
  },
  advanced: {
    requestTimeoutMs: 15_000,
  },
  activeProvider: {
    providerId: null,
    sourceSelection: {
      mode: 'auto',
    },
    targetLanguage: null,
  },
  targetHistory: [],
}
