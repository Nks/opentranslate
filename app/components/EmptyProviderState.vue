<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="flex flex-col items-center gap-4 text-center max-w-md">
      <UIcon
        name="i-fluent-cloud-off-24-regular"
        class="size-12 text-muted"
      />
      <h2 class="text-lg font-semibold">
        Configure a provider to start translating
      </h2>
      <p class="text-sm text-muted">
        OpenTranslate Desktop needs a configured translation provider
        before it can translate text. Open Settings to enable
        Google Cloud Translation or LibreTranslate.
      </p>
      <UButton
        to="/settings"
        icon="i-fluent-settings-24-regular"
        aria-label="Open provider settings"
      >
        Open Settings
      </UButton>
    </div>
  </div>
</template>
