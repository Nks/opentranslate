import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createHistoryStore, type HistoryStore,
} from '@electron/services/history/store'
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

const providers = [googleProviderDescriptor, libreTranslateProviderDescriptor]

const ENTRY_INPUT = {
  sourceText: 'hello',
  translatedText: 'hola',
  sourceLanguageCode: 'en',
  targetLanguageCode: 'es',
  provider: 'libretranslate',
}

describe('history handlers — history:add round-trip', () => {
  let dir: string
  let historyDb: HistoryStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ot-history-handlers-'))
    historyDb = createHistoryStore(join(dir, 'history.db'))
  })

  afterEach(async () => {
    historyDb.close()
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
    expect(historyDb.list({})).toHaveLength(1)
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
    expect(historyDb.list({})).toHaveLength(0)
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
    expect(historyDb.list({})).toHaveLength(1)
  })
})
