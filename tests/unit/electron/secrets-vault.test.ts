import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, readFile, rm,
} from 'node:fs/promises'
import {
  tmpdir,
} from 'node:os'
import {
  join,
} from 'node:path'
import {
  createSecretsVault,
  SECRETS_FILE,
  type SafeStorageLike,
} from '@electron/services/secrets/vault'

class FakeSafeStorage implements SafeStorageLike {
  constructor(private readonly available: boolean) {}

  isEncryptionAvailable(): boolean {
    return this.available
  }

  encryptString(plain: string): Buffer {
    return Buffer.from(`enc:${plain}`, 'utf8')
  }

  decryptString(encrypted: Buffer): string {
    const text = encrypted.toString('utf8')

    if (!text.startsWith('enc:')) {
      throw new Error('cipher mismatch')
    }

    return text.slice(4)
  }
}

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ot-secrets-'))
}

describe('secrets vault (safeStorage available)', () => {
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

  it('reports empty presence before anything is stored', async () => {
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(true),
    })
    const result = await vault.test('google')
    expect(result.present).toBe(false)
    expect(result.lastUpdated).toBeNull()
  })

  it('stores and reports presence without returning the value', async () => {
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(true),
    })
    const storeResult = await vault.set('google', 'my-very-secret')
    expect(storeResult.stored).toBe(true)

    const presence = await vault.test('google')
    expect(presence.present).toBe(true)
    expect(presence.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const disk = await readFile(join(dir, SECRETS_FILE), 'utf8')
    expect(disk).not.toContain('my-very-secret')
  })

  it('round-trips the cipher through the main-only get() accessor', async () => {
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(true),
    })
    await vault.set('libretranslate', 'api-key-abc-123')
    const recovered = await vault.getMainOnly('libretranslate')
    expect(recovered).toBe('api-key-abc-123')
  })

  it('removes a stored secret on delete', async () => {
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(true),
    })
    await vault.set('google', 'x')
    await vault.delete('google')
    const presence = await vault.test('google')
    expect(presence.present).toBe(false)
  })
})

describe('secrets vault (safeStorage unavailable)', () => {
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

  it('keeps secrets ephemeral in memory and never writes to disk', async () => {
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(false),
    })
    const storeResult = await vault.set('google', 'ephemeral-secret')
    expect(storeResult.stored).toBe(true)
    expect(storeResult.ephemeral).toBe(true)

    const presence = await vault.test('google')
    expect(presence.present).toBe(true)

    const recovered = await vault.getMainOnly('google')
    expect(recovered).toBe('ephemeral-secret')

    await expect(readFile(join(dir, SECRETS_FILE), 'utf8')).rejects.toThrow()
  })
})
