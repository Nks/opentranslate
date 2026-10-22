import {
  readFile, writeFile, rename, mkdir,
} from 'node:fs/promises'
import {
  join,
} from 'node:path'

export const SECRETS_FILE = 'secrets.json'

export interface SafeStorageLike {
  isEncryptionAvailable: () => boolean
  encryptString: (plainText: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export interface SecretsVaultInput {
  userDataDir: string
  safeStorage: SafeStorageLike
}

export interface SetResult {
  stored: boolean
  ephemeral: boolean
}

export interface PresenceResult {
  present: boolean
  lastUpdated: string | null
}

export interface SecretsVault {
  set: (providerId: string, secret: string) => Promise<SetResult>
  test: (providerId: string) => Promise<PresenceResult>
  delete: (providerId: string) => Promise<void>
  /**
   * Main-process-only accessor. Provider adapters in Phase 4 will call this
   * to read the plaintext. It is NOT reachable from the preload bridge.
   */
  getMainOnly: (providerId: string) => Promise<string | null>
}

interface StoredEntry {
  cipher: string
  lastUpdated: string
}

type SecretsFile = Record<string, StoredEntry>

interface EphemeralEntry {
  value: string
  lastUpdated: string
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

async function atomicWrite(targetPath: string, data: string): Promise<void> {
  const tmpPath = `${targetPath}.tmp`
  await writeFile(tmpPath, data, 'utf8')
  await rename(tmpPath, targetPath)
}

export function createSecretsVault(input: SecretsVaultInput): SecretsVault {
  const targetPath = join(input.userDataDir, SECRETS_FILE)
  const ephemeral = new Map<string, EphemeralEntry>()
  const canPersist = input.safeStorage.isEncryptionAvailable()

  async function loadFile(): Promise<SecretsFile> {
    try {
      const raw = await readFile(targetPath, 'utf8')

      return JSON.parse(raw) as SecretsFile
    } catch (err) {
      if (isEnoent(err)) {
        return {}
      }

      throw err
    }
  }

  async function persistFile(file: SecretsFile): Promise<void> {
    await mkdir(input.userDataDir, {
      recursive: true,
    })
    await atomicWrite(targetPath, JSON.stringify(file, null, 2))
  }

  async function set(providerId: string, secret: string): Promise<SetResult> {
    const lastUpdated = new Date().toISOString()

    if (!canPersist) {
      ephemeral.set(providerId, {
        value: secret,
        lastUpdated,
      })

      return {
        stored: true,
        ephemeral: true,
      }
    }
    const cipher = input.safeStorage.encryptString(secret).toString('base64')
    const file = await loadFile()
    file[providerId] = {
      cipher,
      lastUpdated,
    }
    await persistFile(file)

    return {
      stored: true,
      ephemeral: false,
    }
  }

  async function test(providerId: string): Promise<PresenceResult> {
    if (!canPersist) {
      const entry = ephemeral.get(providerId)

      if (!entry) {
        return {
          present: false,
          lastUpdated: null,
        }
      }

      return {
        present: true,
        lastUpdated: entry.lastUpdated,
      }
    }
    const file = await loadFile()
    const entry = file[providerId]

    if (!entry) {
      return {
        present: false,
        lastUpdated: null,
      }
    }

    return {
      present: true,
      lastUpdated: entry.lastUpdated,
    }
  }

  async function deleteEntry(providerId: string): Promise<void> {
    if (!canPersist) {
      ephemeral.delete(providerId)

      return
    }
    const file = await loadFile()
    delete file[providerId]
    await persistFile(file)
  }

  async function getMainOnly(providerId: string): Promise<string | null> {
    if (!canPersist) {
      const entry = ephemeral.get(providerId)

      return entry ? entry.value : null
    }
    const file = await loadFile()
    const entry = file[providerId]

    if (!entry) {
      return null
    }
    const buffer = Buffer.from(entry.cipher, 'base64')

    return input.safeStorage.decryptString(buffer)
  }

  return {
    set,
    test,
    delete: deleteEntry,
    getMainOnly,
  }
}
