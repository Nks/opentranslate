import { useDebounceFn } from '@vueuse/core'
import { useHistoryStore } from '@app/stores/history'
import { useApi } from '@app/composables/useApi'

const SEARCH_DEBOUNCE_MS = 300

/**
 * Composable for translation history operations.
 *
 * Provides CRUD actions (load, delete, clear) and debounced search.
 * All IPC calls go through `useApi()`.
 */
export function useHistory() {
  const store = useHistoryStore()

  async function loadEntries() {
    store.loading = true
    store.error = null

    try {
      const api = useApi()

      if (store.searchQuery.trim().length > 0) {
        store.entries = await api.history.search({ query: store.searchQuery })
      } else {
        store.entries = await api.history.list({})
      }
    } catch (err) {
      store.error = err instanceof Error ? err.message : String(err)
    } finally {
      store.loading = false
    }
  }

  const debouncedLoad = useDebounceFn(loadEntries, SEARCH_DEBOUNCE_MS)

  async function deleteEntry(id: string) {
    try {
      const api = useApi()
      await api.history.delete({ id })
      store.entries = store.entries.filter((entry) => entry.id !== id)
    } catch (err) {
      store.error = err instanceof Error ? err.message : String(err)
    }
  }

  async function clearAll() {
    try {
      const api = useApi()
      await api.history.clear()
      store.entries = []
    } catch (err) {
      store.error = err instanceof Error ? err.message : String(err)
    }
  }

  function setSearchQuery(query: string) {
    store.searchQuery = query
    void debouncedLoad()
  }

  return {
    loadEntries,
    deleteEntry,
    clearAll,
    setSearchQuery,
  }
}
