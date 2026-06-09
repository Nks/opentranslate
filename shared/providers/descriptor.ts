import type {
  ZodType,
} from 'zod'
import type {
  TranslationProvider,
} from '@shared/providers/contract'

/**
 * Provider Descriptor — the contract every translation provider must satisfy
 * to be discoverable at runtime and auto-rendered in the Settings UI.
 *
 * Adding a new provider means: drop a folder under `electron/providers/<id>/`
 * that exports a `ProviderDescriptor` built via `defineProvider<TSettings>()`,
 * and add it to the registry barrel. Translation orchestration, settings
 * store, and IPC handlers pick up the new provider without further changes.
 *
 * The stored `ProviderDescriptor` is intentionally type-erased at the
 * registry boundary so the registry can hold heterogeneous provider
 * settings shapes. Provider authors write against `defineProvider` which
 * preserves the typed settings shape internally, validates with Zod on
 * every adapter instantiation, and hands the strongly-typed object to
 * the adapter factory.
 */

export type ProviderFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'url'
  | 'file-path'

export interface ProviderFieldEnumOption {
  value: string
  label: string
}

export interface ProviderFieldDependency {
  key: string
  equals: string | number | boolean
}

/**
 * Validation profile applied to picked file-path fields. The main-process
 * `settings:pick-file` handler reads + validates the file according to the
 * profile and never lets the contents cross the IPC boundary. Adding a new
 * profile requires adding both a `validate` literal here and the
 * corresponding branch in the pick-file handler.
 */
export type ProviderFieldValidateProfile = 'google-service-account'

export interface ProviderSettingsField {
  key: string
  label: string
  description?: string
  placeholder?: string
  type: ProviderFieldType
  enumOptions?: readonly ProviderFieldEnumOption[]
  required: boolean
  group: 'general' | 'advanced'
  dependsOn?: ProviderFieldDependency
  /**
   * Validation profile for `type: 'file-path'` fields. Only meaningful when
   * the field type is `file-path`; ignored otherwise.
   */
  validate?: ProviderFieldValidateProfile
}

export interface ProviderSecretField {
  key: string
  label: string
  description?: string
  placeholder?: string
  required: boolean
}

export interface ProviderAdapterDeps<TSettings> {
  settings: TSettings
  getSecret: (fieldKey: string) => Promise<string | null>
}

/**
 * Type-erased descriptor stored in the runtime registry.
 */
export interface ProviderDescriptor {
  id: string
  displayName: string
  description: string
  settingsSchema: ZodType
  defaultSettings: unknown
  settingsFields: readonly ProviderSettingsField[]
  secretFields: readonly ProviderSecretField[]
  createAdapter: (deps: ProviderAdapterDeps<unknown>) => TranslationProvider
}

/**
 * Serializable DTO sent across the IPC boundary to the renderer so the
 * Settings UI can render a provider form without knowing the implementation.
 */
export interface ProviderDescriptorDto {
  id: string
  displayName: string
  description: string
  settingsFields: readonly ProviderSettingsField[]
  secretFields: readonly ProviderSecretField[]
}

export interface DefineProviderInput<TSettings> {
  id: string
  displayName: string
  description: string
  settingsSchema: ZodType<TSettings>
  defaultSettings: TSettings
  settingsFields: readonly ProviderSettingsField[]
  secretFields: readonly ProviderSecretField[]
  createAdapter: (deps: ProviderAdapterDeps<TSettings>) => TranslationProvider
}

/**
 * Typed DSL for declaring a provider. The returned `ProviderDescriptor` is
 * type-erased so it can sit alongside descriptors of other shapes in the
 * registry. Runtime validation of the raw settings payload happens inside
 * `createAdapter` before the typed factory runs.
 */
export function defineProvider<TSettings>(
  input: DefineProviderInput<TSettings>,
): ProviderDescriptor {
  return {
    id: input.id,
    displayName: input.displayName,
    description: input.description,
    settingsSchema: input.settingsSchema,
    defaultSettings: input.defaultSettings,
    settingsFields: input.settingsFields,
    secretFields: input.secretFields,
    createAdapter: (deps) => {
      const parsed = input.settingsSchema.parse(deps.settings)

      return input.createAdapter({
        settings: parsed,
        getSecret: deps.getSecret,
      })
    },
  }
}

export function toDescriptorDto(descriptor: ProviderDescriptor): ProviderDescriptorDto {
  return {
    id: descriptor.id,
    displayName: descriptor.displayName,
    description: descriptor.description,
    settingsFields: descriptor.settingsFields,
    secretFields: descriptor.secretFields,
  }
}
