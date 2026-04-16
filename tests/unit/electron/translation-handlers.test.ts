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
  createTranslationHandlers,
} from '@electron/services/translation/handlers'
import {
  createTranslationOrchestrator,
} from '@electron/services/translation/orchestrator'
import {
  createLanguageCatalog,
} from '@electron/services/language-catalog/catalog'
import {
  createSettingsStore,
} from '@electron/services/settings/store'
import {
  createSecretsVault, type SafeStorageLike,
} from '@electron/services/secrets/vault'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'
import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'
import type {
  LanguageSelection,
} from '@electron/services/language-catalog/catalog'
import {
  AppError,
} from '@shared/errors'

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

const providers: ProviderDescriptor[] = [googleProviderDescriptor, libreTranslateProviderDescriptor]

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ot-handlers-'))
}

describe('translation handlers', () => {
  let dir: string
  let selection: LanguageSelection

  beforeEach(async () => {
    dir = await makeTempDir()
    selection = {
      source: {
        mode: 'auto',
      },
      target: 'de',
    }
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  function createDeps() {
    const store = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const vault = createSecretsVault({
      userDataDir: dir,
      safeStorage: new FakeSafeStorage(),
    })
    const orchestrator = createTranslationOrchestrator()
    const catalog = createLanguageCatalog()

    return createTranslationHandlers({
      orchestrator,
      catalog,
      store,
      vault,
      getDescriptor: (id) => providers.find((descriptor) => descriptor.id === id),
      currentSelection: () => selection,
    })
  }

  it('provider:switch throws on unknown provider', async () => {
    const handlers = createDeps()

    try {
      await handlers['provider:switch']({
        providerId: 'nonexistent',
      })
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).message).toContain('nonexistent')
    }
  })

  it('translation:cancel does not throw when nothing is in-flight', () => {
    const handlers = createDeps()

    expect(() => handlers['translation:cancel']()).not.toThrow()
  })

  it('language:list returns empty when provider not cached and no adapter', async () => {
    const handlers = createDeps()
    const result = await handlers['language:list']({
      providerId: 'google',
    })

    expect(result).toEqual([])
  })
})
