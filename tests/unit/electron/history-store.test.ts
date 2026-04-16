import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import {
  mkdtemp, rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHistoryStore } from '@electron/services/history/store'

import type { HistoryStore } from '@electron/services/history/store'

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ot-history-'))
}

const ENTRY = {
  sourceText: 'hello',
  translatedText: 'hola',
  sourceLanguageCode: 'en',
  targetLanguageCode: 'es',
  provider: 'google',
}

describe('history store', () => {
  let dir: string
  let store: HistoryStore

  beforeEach(async () => {
    dir = await makeTempDir()
    store = createHistoryStore(join(dir, 'history.db'))
  })

  afterEach(async () => {
    store.close()
    await rm(dir, {
      recursive: true, force: true,
    })
  })

  it('adds an entry and lists it', () => {
    const entry = store.add(ENTRY, 'forever', true)

    expect(entry).not.toBeNull()
    expect(entry!.id).toBeTruthy()
    expect(entry!.sourceText).toBe('hello')
    expect(entry!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const listed = store.list({})

    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(entry!.id)
  })

  it('returns null when history is disabled', () => {
    const entry = store.add(ENTRY, 'forever', false)

    expect(entry).toBeNull()
    expect(store.list({})).toHaveLength(0)
  })

  it('searches by source and translated text', () => {
    store.add(ENTRY, 'forever', true)
    store.add({
      ...ENTRY,
      sourceText: 'goodbye',
      translatedText: 'adiós',
    }, 'forever', true)

    const bySource = store.search({ query: 'hello' })

    expect(bySource).toHaveLength(1)
    expect(bySource[0]?.sourceText).toBe('hello')

    const byTranslated = store.search({ query: 'adiós' })

    expect(byTranslated).toHaveLength(1)
    expect(byTranslated[0]?.translatedText).toBe('adiós')
  })

  it('deletes a single entry', () => {
    const entry = store.add(ENTRY, 'forever', true)
    store.deleteEntry(entry!.id)

    expect(store.list({})).toHaveLength(0)
  })

  it('clears all entries', () => {
    store.add(ENTRY, 'forever', true)
    store.add({
      ...ENTRY, sourceText: 'two',
    }, 'forever', true)
    store.clear()

    expect(store.list({})).toHaveLength(0)
  })

  it('applies last-100-entries retention', () => {
    for (let idx = 0; idx < 105; idx++) {
      store.add({
        ...ENTRY, sourceText: `entry-${idx}`,
      }, 'last-100-entries', true)
    }

    const all = store.list({ limit: 200 })

    expect(all.length).toBeLessThanOrEqual(100)
  })

  it('lists with offset for pagination', () => {
    for (let idx = 0; idx < 5; idx++) {
      store.add({
        ...ENTRY, sourceText: `entry-${idx}`,
      }, 'forever', true)
    }

    const page = store.list({
      limit: 2, offset: 2,
    })

    expect(page).toHaveLength(2)
  })
})
