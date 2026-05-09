import {
  readFileSync, writeFileSync, renameSync, mkdirSync,
} from 'node:fs'
import {
  dirname,
} from 'node:path'
import {
  randomUUID,
} from 'node:crypto'

import type { HistoryEntry } from '@shared/types/history'
import type { ProviderId } from '@shared/types/provider-id'
import type { HistoryRetentionMode } from '@shared/types/settings'

export interface HistoryAddInput {
  sourceText: string
  translatedText: string
  sourceLanguageCode: string
  targetLanguageCode: string
  provider: string
}

export interface HistoryListInput {
  limit?: number
  offset?: number
}

export interface HistorySearchInput {
  query: string
  limit?: number
}

export interface HistoryStore {
  add: (
    input: HistoryAddInput,
    retentionMode: HistoryRetentionMode,
    enabled: boolean,
  ) => HistoryEntry | null
  list: (input: HistoryListInput) => HistoryEntry[]
  search: (input: HistorySearchInput) => HistoryEntry[]
  deleteEntry: (id: string) => void
  clear: () => void
  close: () => void
}

interface HistoryFile {
  schemaVersion: 1
  entries: HistoryEntry[]
}

const SCHEMA_VERSION = 1
const RETENTION_LAST_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const RETENTION_LAST_100_ENTRIES = 100

function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'ENOENT'
  )
}

function loadFromDisk(filePath: string): HistoryEntry[] {
  let raw: string

  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err: unknown) {
    if (isEnoent(err)) {
      return []
    }

    throw err
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HistoryFile>

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return []
    }

    return parsed.entries
  } catch {
    return []
  }
}

function atomicWrite(filePath: string, payload: HistoryFile): void {
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8')
  renameSync(tmpPath, filePath)
}

export function createHistoryStore(filePath: string): HistoryStore {
  mkdirSync(dirname(filePath), { recursive: true })

  let entries: HistoryEntry[] = loadFromDisk(filePath)

  function persist(): void {
    atomicWrite(filePath, {
      schemaVersion: SCHEMA_VERSION,
      entries,
    })
  }

  function applyRetention(mode: HistoryRetentionMode): void {
    if (mode === 'last-30-days') {
      const cutoff = Date.now() - RETENTION_LAST_30_DAYS_MS
      entries = entries.filter((entry: HistoryEntry): boolean => {
        const createdAtMs = Date.parse(entry.createdAt)

        return Number.isFinite(createdAtMs) && createdAtMs >= cutoff
      })

      return
    }

    if (mode === 'last-100-entries' && entries.length > RETENTION_LAST_100_ENTRIES) {
      entries = entries.slice(0, RETENTION_LAST_100_ENTRIES)
    }
  }

  function add(
    input: HistoryAddInput,
    retentionMode: HistoryRetentionMode,
    enabled: boolean,
  ): HistoryEntry | null {
    if (!enabled) {
      return null
    }

    const entry: HistoryEntry = {
      id: randomUUID(),
      sourceText: input.sourceText,
      translatedText: input.translatedText,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      provider: input.provider as ProviderId,
      createdAt: new Date().toISOString(),
    }

    entries = [entry, ...entries]
    applyRetention(retentionMode)
    persist()

    return entry
  }

  function list(input: HistoryListInput): HistoryEntry[] {
    const offset = input.offset ?? 0
    const limit = input.limit ?? 50

    return entries.slice(offset, offset + limit)
  }

  function search(input: HistorySearchInput): HistoryEntry[] {
    const limit = input.limit ?? 50
    const needle = input.query.toLowerCase()

    if (needle.length === 0) {
      return entries.slice(0, limit)
    }

    const matches: HistoryEntry[] = []

    for (const entry of entries) {
      const inSource = entry.sourceText.toLowerCase().includes(needle)
      const inTranslated = entry.translatedText.toLowerCase().includes(needle)

      if (inSource || inTranslated) {
        matches.push(entry)
      }

      if (matches.length >= limit) {
        break
      }
    }

    return matches
  }

  function deleteEntry(id: string): void {
    const next = entries.filter((entry: HistoryEntry): boolean => entry.id !== id)

    if (next.length === entries.length) {
      return
    }

    entries = next
    persist()
  }

  function clear(): void {
    if (entries.length === 0) {
      return
    }

    entries = []
    persist()
  }

  function close(): void {
    // JSON-backed store has no open handle; provided for API compatibility.
  }

  return {
    add,
    list,
    search,
    deleteEntry,
    clear,
    close,
  }
}
