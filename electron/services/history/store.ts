import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

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

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS history (
  id              TEXT PRIMARY KEY,
  source_text     TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang     TEXT NOT NULL,
  target_lang     TEXT NOT NULL,
  provider        TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_created ON history (created_at DESC);
`

function mapRow(row: Record<string, unknown>): HistoryEntry {
  return {
    id: row.id as string,
    sourceText: row.source_text as string,
    translatedText: row.translated_text as string,
    sourceLanguageCode: row.source_lang as string,
    targetLanguageCode: row.target_lang as string,
    provider: row.provider as ProviderId,
    createdAt: row.created_at as string,
  }
}

export function createHistoryStore(dbPath: string): HistoryStore {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA_SQL)

  const insertStmt = db.prepare(`
    INSERT INTO history (id, source_text, translated_text, source_lang, target_lang, provider, created_at)
    VALUES (@id, @sourceText, @translatedText, @sourceLang, @targetLang, @provider, @createdAt)
  `)
  const listStmt = db.prepare(
    'SELECT * FROM history ORDER BY created_at DESC LIMIT @limit OFFSET @offset',
  )
  const searchStmt = db.prepare(
    'SELECT * FROM history WHERE source_text LIKE @pattern OR translated_text LIKE @pattern ORDER BY created_at DESC LIMIT @limit',
  )
  const deleteStmt = db.prepare('DELETE FROM history WHERE id = @id')
  const clearStmt = db.prepare('DELETE FROM history')
  const pruneOldStmt = db.prepare(
    'DELETE FROM history WHERE created_at < @cutoff',
  )
  const pruneExcessStmt = db.prepare(
    'DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT @keep)',
  )

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

    insertStmt.run({
      id: entry.id,
      sourceText: entry.sourceText,
      translatedText: entry.translatedText,
      sourceLang: entry.sourceLanguageCode,
      targetLang: entry.targetLanguageCode,
      provider: entry.provider,
      createdAt: entry.createdAt,
    })

    applyRetention(retentionMode)

    return entry
  }

  function applyRetention(mode: HistoryRetentionMode): void {
    if (mode === 'last-30-days') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      pruneOldStmt.run({ cutoff })
    } else if (mode === 'last-100-entries') {
      pruneExcessStmt.run({ keep: 100 })
    }
  }

  function list(input: HistoryListInput): HistoryEntry[] {
    const rows = listStmt.all({
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    }) as Record<string, unknown>[]

    return rows.map(mapRow)
  }

  function search(input: HistorySearchInput): HistoryEntry[] {
    const pattern = `%${input.query}%`
    const rows = searchStmt.all({
      pattern,
      limit: input.limit ?? 50,
    }) as Record<string, unknown>[]

    return rows.map(mapRow)
  }

  function deleteEntry(id: string): void {
    deleteStmt.run({ id })
  }

  function clear(): void {
    clearStmt.run()
  }

  function close(): void {
    db.close()
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
