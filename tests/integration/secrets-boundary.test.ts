import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, rm,
} from 'node:fs/promises'
import {
  tmpdir,
} from 'node:os'
import {
  join,
} from 'node:path'
import {
  createSecretsVault, type SafeStorageLike,
} from '@electron/services/secrets/vault'
import {
  createSettingsAndSecretsHandlers,
} from '@electron/services/settings/handlers'
import {
  createSettingsStore,
} from '@electron/services/settings/store'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'

const SECRET_FIXTURE = 'SENSITIVE-FIXTURE-09f3dfb2-9c12-4f0b-8b3a-1f4d6c2e7a11'

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

function containsFixture(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value)

  if (text.includes(SECRET_FIXTURE)) {
    return true
  }
  const base64 = Buffer.from(SECRET_FIXTURE, 'utf8').toString('base64')

  return text.includes(base64)
}

describe('credential-boundary invariant', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ot-boundary-'))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('no IPC handler ever returns the raw secret in any shape', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers: [googleProviderDescriptor, libreTranslateProviderDescriptor],
    })
    await store.load()
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(),
    })
    await vault.set('google', SECRET_FIXTURE)

    const handlers = createSettingsAndSecretsHandlers({
      store,
      vault,
    })

    const settingsResponse = await handlers['settings:get']()
    expect(containsFixture(settingsResponse)).toBe(false)

    const secretsTest = await handlers['secrets:test']({
      providerId: 'google',
    })
    expect(containsFixture(secretsTest)).toBe(false)
    expect(secretsTest.present).toBe(true)

    const settingsUpdate = await handlers['settings:update']({
      app: {
        debounceMs: 500,
      },
    })
    expect(containsFixture(settingsUpdate)).toBe(false)

    // secrets:set echoes only a boolean, never the input
    const secretsSet = await handlers['secrets:set']({
      providerId: 'google',
      secret: SECRET_FIXTURE,
    })
    expect(containsFixture(secretsSet)).toBe(false)
    expect(secretsSet.stored).toBe(true)
  })

  it('no handler key is named secrets:get', async () => {
    const store = createSettingsStore({
      userDataDir: dir,
      providers: [googleProviderDescriptor, libreTranslateProviderDescriptor],
    })
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(),
    })
    const handlers = createSettingsAndSecretsHandlers({
      store,
      vault,
    })

    const keys = Object.keys(handlers)
    expect(keys).not.toContain('secrets:get')
    expect(keys.some((key) => key.includes('get') && key.startsWith('secrets:'))).toBe(false)
  })
})
