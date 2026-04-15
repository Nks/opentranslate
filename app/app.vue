<script setup lang="ts">
interface OpenTranslateWindowApi {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<NodeJS.Platform>
}

function readApi(): OpenTranslateWindowApi | null {
  if (typeof window === 'undefined') {
    return null
  }
  const candidate = (window as unknown as { api?: OpenTranslateWindowApi }).api
  return candidate ?? null
}

const { data: version } = await useAsyncData('app-version', async () => {
  const api = readApi()
  if (!api) {
    return '0.0.0'
  }
  return api.getVersion()
})
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <UCard>
        <template #header>
          <h1 class="text-xl font-semibold">
            OpenTranslate Desktop
          </h1>
        </template>
        <p class="text-gray-600 dark:text-gray-300">
          Phase 2 bootstrap — Electron shell online.
        </p>
        <p class="mt-2 text-sm text-gray-500">
          Version: {{ version }}
        </p>
      </UCard>
    </div>
  </UApp>
</template>
