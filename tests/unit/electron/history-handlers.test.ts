import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createHistoryHandlers,
} from '@electron/services/history/handlers'
import {
  createSettingsStore,
} from '@electron/services/settings/store'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'
import type {
  HistoryAddInput, HistoryListInput, HistorySearchInput, HistoryStore,
} from '@electron/services/history/store'
import type { HistoryEntry } from '@shared/types/history'
import type { ProviderId } from '@shared/types/provider-id'
import type { HistoryRetentionMode } from '@shared/types/settings'

const providers = [googleProviderDescriptor, libreTranslateProviderDescriptor]

const ENTRY_INPUT = {
  sourceText: 'hello',
  translatedText: 'hola',
  sourceLanguageCode: 'en',
  targetLanguageCode: 'es',
  provider: 'libretranslate',
}

interface FakeHistoryStore extends HistoryStore {
  entries: HistoryEntry[]
  lastRetention: HistoryRetentionMode | null
  closeCalls: number
}

function createFakeHistoryStore(): FakeHistoryStore {
  const fake: FakeHistoryStore = {
    entries: [],
    lastRetention: null,
    closeCalls: 0,
    add(
      input: HistoryAddInput,
      retentionMode: HistoryRetentionMode,
      enabled: boolean,
    ): HistoryEntry | null {
      fake.lastRetention = retentionMode

      if (!enabled) {
        return null
      }

      const entry: HistoryEntry = {
        id: `entry-${fake.entries.length + 1}`,
        sourceText: input.sourceText,
        translatedText: input.translatedText,
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: input.targetLanguageCode,
        provider: input.provider as ProviderId,
        createdAt: new Date(2026, 0, 1, 12, 0, fake.entries.length).toISOString(),
      }
      fake.entries = [entry, ...fake.entries]

      return entry
    },
    list(input: HistoryListInput): HistoryEntry[] {
      const offset = input.offset ?? 0
      const limit = input.limit ?? 50

      return fake.entries.slice(offset, offset + limit)
    },
    search(input: HistorySearchInput): HistoryEntry[] {
      const limit = input.limit ?? 50
      const needle = input.query.toLowerCase()
      const matches = fake.entries.filter((entry: HistoryEntry): boolean => {
        const sourceMatches = entry.sourceText.toLowerCase().includes(needle)
        const translatedMatches = entry.translatedText.toLowerCase().includes(needle)

        return sourceMatches || translatedMatches
      })

      return matches.slice(0, limit)
    },
    deleteEntry(id: string): void {
      fake.entries = fake.entries.filter((entry: HistoryEntry): boolean => entry.id !== id)
    },
    clear(): void {
      fake.entries = []
    },
    close(): void {
      fake.closeCalls += 1
    },
  }

  return fake
}

describe('history handlers — history:add round-trip', () => {
  let dir: string
  let historyDb: FakeHistoryStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ot-history-handlers-'))
    historyDb = createFakeHistoryStore()
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('persists an entry and returns it when historyEnabled is true (default)', async () => {
    const settings = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await settings.load()

    const handlers = createHistoryHandlers({
      history: historyDb,
      settings,
    })

    const result = await handlers['history:add'](ENTRY_INPUT)

    expect(result).not.toBeNull()
    expect(result!.id).toBeTruthy()
    expect(result!.sourceText).toBe('hello')
    expect(historyDb.entries).toHaveLength(1)
  })

  it('returns null without writing when historyEnabled is false', async () => {
    const settings = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await settings.load()
    await settings.save({ app: { historyEnabled: false } })

    const handlers = createHistoryHandlers({
      history: historyDb,
      settings,
    })
    const result = await handlers['history:add'](ENTRY_INPUT)

    expect(result).toBeNull()
    expect(historyDb.entries).toHaveLength(0)
  })

  it('survives the safeHandler await cycle (returns a real Promise)', async () => {
    const settings = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await settings.load()

    const handlers = createHistoryHandlers({
      history: historyDb,
      settings,
    })
    const returned = handlers['history:add'](ENTRY_INPUT)

    expect(returned).toBeInstanceOf(Promise)
    const entry = await returned
    expect(entry?.sourceText).toBe('hello')
  })

  it('writes immediately on a fresh settings store (default historyEnabled === true)', async () => {
    const settings = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    const handlers = createHistoryHandlers({
      history: historyDb,
      settings,
    })

    const result = await handlers['history:add'](ENTRY_INPUT)

    expect(result).not.toBeNull()
    expect(historyDb.entries).toHaveLength(1)
  })

  it('forwards the configured retentionMode to the store', async () => {
    const settings = createSettingsStore({
      userDataDir: dir,
      providers,
    })
    await settings.load()
    await settings.save({ app: { historyRetentionMode: 'last-100-entries' } })

    const handlers = createHistoryHandlers({
      history: historyDb,
      settings,
    })
    await handlers['history:add'](ENTRY_INPUT)

    expect(historyDb.lastRetention).toBe('last-100-entries')
  })
})
