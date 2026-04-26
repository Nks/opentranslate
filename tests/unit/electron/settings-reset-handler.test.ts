import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, rm, readFile,
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
} from '@electron/services/settings/store'
import {
  createSecretsVault, type SafeStorageLike,
} from '@electron/services/secrets/vault'
import {
  createSettingsAndSecretsHandlers,
} from '@electron/services/settings/handlers'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'
import {
  defaultAppSettings,
} from '@shared/schemas/settings'

class FakeSafeStorage implements SafeStorageLike {
  isEncryptionAvailable(): boolean {
    return true
  }

  encryptString(plain: string): Buffer {
    return Buffer.from(`enc:${plain}`, 'utf8')
  }

  decryptString(encrypted: Buffer): string {
    return encrypted.toString('utf8').slice(4)
  }
}

const providers = [googleProviderDescriptor, libreTranslateProviderDescriptor]

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ot-settings-reset-'))
}

describe('settings:reset handler', () => {
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

  it('replaces mutated settings with defaults and returns them', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(),
    })
    const handlers = createSettingsAndSecretsHandlers({
      store,
      vault,
    })

    await store.load()
    await store.save({
      app: {
        ...defaultAppSettings,
        debounceMs: 999,
        activeProvider: 'google',
      },
    })

    const afterReset = await handlers['settings:reset']()

    expect(afterReset.app).toEqual(defaultAppSettings)
    expect(afterReset.providers.google).toEqual(googleProviderDescriptor.defaultSettings)
    expect(afterReset.providers.libretranslate).toEqual(
      libreTranslateProviderDescriptor.defaultSettings,
    )
  })

  it('writes the defaults to disk so a fresh store load sees them', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(),
    })
    const handlers = createSettingsAndSecretsHandlers({
      store,
      vault,
    })

    await store.load()
    await store.save({
      app: {
        ...defaultAppSettings,
        debounceMs: 777,
      },
    })
    await handlers['settings:reset']()

    const raw = await readFile(join(dir, SETTINGS_FILE), 'utf8')
    const parsed = JSON.parse(raw)

    expect(parsed.app.debounceMs).toBe(defaultAppSettings.debounceMs)

    const fresh = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const reloaded = await fresh.load()

    expect(reloaded.app.debounceMs).toBe(defaultAppSettings.debounceMs)
  })
})
