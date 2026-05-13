import {
  readFile, writeFile, rename, mkdir,
} from 'node:fs/promises'
import {
  join,
} from 'node:path'
import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  defaultSettingsFile,
  settingsFileSchema,
  type SettingsFile,
} from '@shared/schemas/settings-file'
import type {
  AppSettings,
} from '@shared/types/settings'
import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'

export const SETTINGS_FILE = 'settings.json'
export const CURRENT_SCHEMA_VERSION = CURRENT_SETTINGS_SCHEMA_VERSION

export interface SettingsStoreInput {
  userDataDir: string
  providers: readonly ProviderDescriptor[]
}

export interface SettingsUpdate {
  app?: Partial<AppSettings>
  providers?: Record<string, unknown>
}

export interface SettingsStore {
  load: () => Promise<SettingsFile>
  save: (patch: SettingsUpdate) => Promise<SettingsFile>
  reset: () => Promise<SettingsFile>
}

function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as {
      code: unknown
    }).code === 'ENOENT'
  )
}

function buildDefaultProviderSettings(
  providers: readonly ProviderDescriptor[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const descriptor of providers) {
    out[descriptor.id] = descriptor.defaultSettings
  }

  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateProviderSlice(
  descriptor: ProviderDescriptor,
  currentSlice: unknown,
  patchSlice: unknown,
): unknown {
  const hasPatch = patchSlice !== undefined
  const basis = currentSlice ?? descriptor.defaultSettings

  if (!hasPatch) {
    const result = descriptor.settingsSchema.safeParse(basis)

    return result.success ? result.data : descriptor.defaultSettings
  }

  if (!isPlainObject(basis) || !isPlainObject(patchSlice)) {
    const direct = descriptor.settingsSchema.safeParse(patchSlice)

    if (direct.success) {
      return direct.data
    }

    throw new Error(
      `Invalid settings patch for provider "${descriptor.id}": ` +
      `${direct.error.issues[0]?.message ?? 'unknown'}`,
    )
  }

  const merged = {
    ...basis,
    ...patchSlice,
  }
  const merging = descriptor.settingsSchema.safeParse(merged)

  if (merging.success) {
    return merging.data
  }

  throw new Error(
    `Invalid settings patch for provider "${descriptor.id}": ` +
    `${merging.error.issues[0]?.message ?? 'unknown'}`,
  )
}

function mergeProvidersWithRegistry(
  providers: readonly ProviderDescriptor[],
  currentMap: Record<string, unknown>,
  patchMap: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const descriptor of providers) {
    const currentSlice = currentMap[descriptor.id]
    const patchSlice = patchMap?.[descriptor.id]
    out[descriptor.id] = validateProviderSlice(descriptor, currentSlice, patchSlice)
  }

  return out
}

function mergeSettings(
  providers: readonly ProviderDescriptor[],
  current: SettingsFile,
  patch: SettingsUpdate,
): SettingsFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: {
      ...current.app,
      ...(patch.app ?? {}),
    },
    providers: mergeProvidersWithRegistry(providers, current.providers, patch.providers),
  }
}

function migrateActiveProvider(app: Record<string, unknown>): Record<string, unknown> {
  const raw = app.activeProvider

  if (typeof raw === 'string') {
    return {
      ...app,
      activeProvider: {
        providerId: raw,
        sourceSelection: {
          mode: 'auto',
        },
        targetLanguage: null,
      },
    }
  }

  return app
}

function migrateTrayAndCloseBehavior(app: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...app,
  }

  if (next.showTray === undefined) {
    next.showTray = defaultSettingsFile.app.showTray
  }

  if (next.closeBehavior === undefined) {
    next.closeBehavior = defaultSettingsFile.app.closeBehavior
  }

  return next
}

function migrate(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') {
    return raw
  }
  const candidate = raw as {
    schemaVersion?: unknown
    app?: unknown
  }

  let next: Record<string, unknown> = {
    ...(candidate as Record<string, unknown>),
  }

  if (candidate.schemaVersion === undefined) {
    next.schemaVersion = CURRENT_SCHEMA_VERSION
  }

  if (next.app !== undefined && typeof next.app === 'object' && next.app !== null) {
    const appCandidate = next.app as Record<string, unknown>
    const withActiveProvider = migrateActiveProvider(appCandidate)
    const withTray = migrateTrayAndCloseBehavior(withActiveProvider)
    next = {
      ...next,
      app: withTray,
    }
  }

  return next
}

async function atomicWrite(targetPath: string, data: string): Promise<void> {
  const tmpPath = `${targetPath}.tmp`
  await writeFile(tmpPath, data, 'utf8')
  await rename(tmpPath, targetPath)
}

async function quarantine(targetPath: string): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const quarantinePath = `${targetPath}.corrupted-${stamp}`
    await rename(targetPath, quarantinePath)
  } catch {
    // best-effort
  }
}

export function createSettingsStore(input: SettingsStoreInput): SettingsStore {
  const targetPath = join(input.userDataDir, SETTINGS_FILE)
  const defaults: SettingsFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: defaultSettingsFile.app,
    providers: buildDefaultProviderSettings(input.providers),
  }
  let current: SettingsFile = defaults

  async function load(): Promise<SettingsFile> {
    try {
      const raw = await readFile(targetPath, 'utf8').catch((err: unknown) => {
        if (isEnoent(err)) {
          return null
        }

        throw err
      })

      if (raw === null) {
        current = defaults

        return current
      }
      let parsed: unknown

      try {
        parsed = JSON.parse(raw)
      } catch {
        await quarantine(targetPath)
        current = defaults

        return current
      }
      const migrated = migrate(parsed)
      const shell = settingsFileSchema.safeParse(migrated)

      if (!shell.success) {
        await quarantine(targetPath)
        current = defaults

        return current
      }

      const providersValidated: Record<string, unknown> = {}

      for (const descriptor of input.providers) {
        const slice = shell.data.providers[descriptor.id]
        const perProvider = descriptor.settingsSchema.safeParse(
          slice ?? descriptor.defaultSettings,
        )
        providersValidated[descriptor.id] = perProvider.success
          ? perProvider.data
          : descriptor.defaultSettings
      }

      current = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        app: shell.data.app,
        providers: providersValidated,
      }

      return current
    } catch {
      current = defaults

      return current
    }
  }

  async function save(patch: SettingsUpdate): Promise<SettingsFile> {
    const merged = mergeSettings(input.providers, current, patch)
    const appValidated = settingsFileSchema.shape.app.safeParse(merged.app)

    if (!appValidated.success) {
      const issue = appValidated.error.issues[0]
      const pathLabel = issue?.path.join('.') ?? 'unknown'

      throw new Error(`Invalid settings update at app.${pathLabel}: ${issue?.message}`)
    }

    await mkdir(input.userDataDir, {
      recursive: true,
    })
    await atomicWrite(targetPath, JSON.stringify(merged, null, 2))
    current = merged

    return current
  }

  async function reset(): Promise<SettingsFile> {
    current = defaults
    await mkdir(input.userDataDir, {
      recursive: true,
    })
    await atomicWrite(targetPath, JSON.stringify(defaults, null, 2))

    return current
  }

  return {
    load,
    save,
    reset,
  }
}
