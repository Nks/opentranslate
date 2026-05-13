import type {
  HistoryStore, HistoryAddInput,
} from '@electron/services/history/store'
import type { SettingsStore } from '@electron/services/settings/store'
import type { HistoryEntry } from '@shared/types/history'

export interface HistoryHandlers {
  'history:add': (input: HistoryAddInput) => Promise<HistoryEntry | null>
  'history:list': (input: {
    limit?: number
    offset?: number
  }) => HistoryEntry[]
  'history:search': (input: {
    query: string
    limit?: number
  }) => HistoryEntry[]
  'history:delete': (input: { id: string }) => void
  'history:clear': () => void
  'history:toggle': (input: { enabled: boolean }) => Promise<void>
}

export interface HistoryHandlerDeps {
  history: HistoryStore
  settings: SettingsStore
}

export function createHistoryHandlers(deps: HistoryHandlerDeps): HistoryHandlers {
  return {
    'history:add': async (input) => {
      const file = await deps.settings.load()

      return deps.history.add(
        input,
        file.app.historyRetentionMode,
        file.app.historyEnabled,
      )
    },
    'history:list': (input) => deps.history.list(input),
    'history:search': (input) => deps.history.search(input),
    'history:delete': ({ id }) => deps.history.deleteEntry(id),
    'history:clear': () => deps.history.clear(),
    'history:toggle': async ({ enabled }) => {
      await deps.settings.save({ app: { historyEnabled: enabled } })
    },
  }
}
