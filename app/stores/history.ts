import { defineStore } from 'pinia'

import type { HistoryEntry } from '@shared/types/history'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    entries: [] as HistoryEntry[],
    searchQuery: '',
    loading: false,
    error: null as string | null,
  }),
  getters: {
    hasEntries: (state): boolean => state.entries.length > 0,
  },
})
