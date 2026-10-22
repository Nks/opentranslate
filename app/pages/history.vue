<script setup lang="ts">
import { onMounted } from 'vue'
import { useHistoryStore } from '@app/stores/history'
import { useTranslationStore } from '@app/stores/translation'
import { useProvidersStore } from '@app/stores/providers'
import { useHistory } from '@app/composables/useHistory'

import type { HistoryEntry } from '@shared/types/history'

const historyStore = useHistoryStore()
const translationStore = useTranslationStore()
const providersStore = useProvidersStore()
const {
  loadEntries, deleteEntry, clearAll, setSearchQuery,
} = useHistory()

onMounted(() => {
  void loadEntries()
})

function reopenEntry(entry: HistoryEntry) {
  translationStore.sourceText = entry.sourceText
  translationStore.translatedText = entry.translatedText

  if (entry.sourceLanguageCode) {
    providersStore.sourceSelection = {
      mode: 'explicit',
      code: entry.sourceLanguageCode,
    }
  }

  providersStore.targetLanguage = entry.targetLanguageCode
  navigateTo('/')
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-default">
      <div class="flex items-center justify-between px-4 py-3 border-b border-default">
        <div class="flex items-center gap-3">
          <UButton
            to="/"
            variant="ghost"
            size="xs"
            icon="i-fluent-arrow-left-24-regular"
            label="Translate"
            aria-label="Back to translate"
          />
          <h1 class="text-lg font-semibold">
            History
          </h1>
        </div>
        <UButton
          v-if="historyStore.hasEntries"
          size="xs"
          variant="ghost"
          color="red"
          aria-label="Clear all history"
          @click="clearAll"
        >
          Clear All
        </UButton>
      </div>

      <div class="px-4 py-3">
        <UInput
          :model-value="historyStore.searchQuery"
          placeholder="Search history..."
          aria-label="Search history"
          @update:model-value="(val: string) => setSearchQuery(val)"
        />
      </div>

      <div class="flex-1 px-4 pb-4 overflow-y-auto">
        <div
          v-if="historyStore.loading"
          class="flex items-center justify-center py-8"
        >
          <UIcon
            name="i-fluent-arrow-sync-24-regular"
            class="animate-spin text-primary"
          />
        </div>

        <div
          v-else-if="historyStore.error"
          class="text-error py-4"
        >
          {{ historyStore.error }}
        </div>

        <div
          v-else-if="!historyStore.hasEntries"
          class="text-dimmed text-center py-8"
        >
          <template v-if="historyStore.searchQuery">
            No results for "{{ historyStore.searchQuery }}"
          </template>
          <template v-else>
            No translation history yet
          </template>
        </div>

        <template v-else>
          <HistoryEntry
            v-for="entry in historyStore.entries"
            :key="entry.id"
            :entry="entry"
            @reopen="reopenEntry"
            @delete="deleteEntry"
          />
        </template>
      </div>
    </div>
  </UApp>
</template>
