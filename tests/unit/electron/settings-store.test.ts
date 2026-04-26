import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, readFile, rm, writeFile, readdir,
} from 'node:fs/promises'
import {
  tmpdir,
} from 'node:os'
import {
  join,
} from 'node:path'
import {
  createSettingsStore,
  SETTINGS_FILE,
  CURRENT_SCHEMA_VERSION,
} from '@electron/services/settings/store'
import {
  defaultAppSettings,
} from '@shared/schemas/settings'
import {
  defaultGoogleProviderSettings,
  defaultLibreTranslateProviderSettings,
} from '@shared/schemas/provider-settings'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'

const providers = [googleProviderDescriptor, libreTranslateProviderDescriptor]

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ot-settings-'))
}

describe('settings store', () => {
  let dir: string

  beforeEach(async () => {
    dir = await makeTempDir()
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('returns the default settings seeded from the provider registry', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const loaded = await store.load()

    expect(loaded.app).toEqual(defaultAppSettings)
    expect(loaded.providers.google).toEqual(defaultGoogleProviderSettings)
    expect(loaded.providers.libretranslate).toEqual(defaultLibreTranslateProviderSettings)
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('persists app settings atomically and reloads them', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await store.load()
    await store.save({
      app: {
        ...defaultAppSettings,
        debounceMs: 600,
        activeProvider: 'google',
      },
    })
    const listAfterWrite = await readdir(dir)

    expect(listAfterWrite).toContain(SETTINGS_FILE)
    expect(listAfterWrite.every((name) => !name.endsWith('.tmp'))).toBe(true)

    const raw = await readFile(join(dir, SETTINGS_FILE), 'utf8')
    const parsed = JSON.parse(raw)

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(parsed.app.debounceMs).toBe(600)
    expect(parsed.app.activeProvider).toBe('google')

    const storeTwo = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const reloaded = await storeTwo.load()

    expect(reloaded.app.debounceMs).toBe(600)
  })

  it('rejects an invalid partial update before writing to disk', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await store.load()

    await expect(
      store.save({
        app: {
          ...defaultAppSettings,
          debounceMs: -5,
        },
      }),
    ).rejects.toThrow(/debounceMs/i)
    const listAfterFailure = await readdir(dir)

    expect(listAfterFailure).not.toContain(SETTINGS_FILE)
  })

  it('rejects an invalid per-provider settings patch using that provider schema', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await store.load()

    await expect(
      store.save({
        providers: {
          libretranslate: {
            endpoint: 'ftp://nope.example',
          },
        },
      }),
    ).rejects.toThrow(/libretranslate/i)
  })

  it('persists a valid per-provider settings patch using that provider schema', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await store.load()
    const saved = await store.save({
      providers: {
        libretranslate: {
          endpoint: 'https://libre.example.com',
          allowSelfSignedTls: true,
        },
      },
    })
    const slice = saved.providers.libretranslate as {
      endpoint: string
      allowSelfSignedTls: boolean
    }

    expect(slice.endpoint).toBe('https://libre.example.com')
    expect(slice.allowSelfSignedTls).toBe(true)
  })

  it('falls back to defaults and quarantines a corrupted file', async () => {
    await writeFile(join(dir, SETTINGS_FILE), '{ not valid json', 'utf8')
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const loaded = await store.load()

    expect(loaded.app).toEqual(defaultAppSettings)

    const entries = await readdir(dir)
    const quarantined = entries.find((name) => name.startsWith(`${SETTINGS_FILE}.corrupted-`))

    expect(quarantined).toBeDefined()
  })

  it('falls back to defaults when the payload fails Zod validation at the app level', async () => {
    const invalidPayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      app: {
        ...defaultAppSettings,
        activeProvider: 'unknown-provider',
      },
      providers: {
        google: defaultGoogleProviderSettings,
        libretranslate: defaultLibreTranslateProviderSettings,
      },
    }
    await writeFile(join(dir, SETTINGS_FILE), JSON.stringify(invalidPayload), 'utf8')
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const loaded = await store.load()

    expect(loaded.app.activeProvider).toBe(defaultAppSettings.activeProvider)
  })

  it('reset() writes defaults and returns them', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await store.load()
    await store.save({
      app: {
        ...defaultAppSettings,
        debounceMs: 999,
      },
    })
    const afterReset = await store.reset()

    expect(afterReset.app.debounceMs).toBe(defaultAppSettings.debounceMs)
    expect(afterReset.app).toEqual(defaultAppSettings)

    const raw = await readFile(join(dir, SETTINGS_FILE), 'utf8')
    const parsed = JSON.parse(raw)

    expect(parsed.app.debounceMs).toBe(defaultAppSettings.debounceMs)
  })

  it('load() handles unexpected fs errors gracefully', async () => {
    const store = createSettingsStore({
      userDataDir: '/nonexistent/path/that/cannot/exist',
      providers,
    })
    const loaded = await store.load()

    expect(loaded.app).toEqual(defaultAppSettings)
  })
})
