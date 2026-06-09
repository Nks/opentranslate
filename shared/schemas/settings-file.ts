import {
  z,
} from 'zod'
import {
  appSettingsSchema, defaultAppSettings,
} from '@shared/schemas/settings'

export const CURRENT_SETTINGS_SCHEMA_VERSION = 1

/**
 * Top-level settings file schema.
 *
 * `providers` is a dynamic map keyed by provider id. Each slice is validated
 * against that provider's own Zod schema (from its `ProviderDescriptor`) by
 * the settings store at load and save time. Adding a new provider does not
 * require touching this schema.
 */
export const settingsFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  app: appSettingsSchema,
  providers: z.record(z.string(), z.unknown()),
})

export type SettingsFile = z.infer<typeof settingsFileSchema>

export const defaultSettingsFile: SettingsFile = {
  schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  app: defaultAppSettings,
  providers: {},
}
