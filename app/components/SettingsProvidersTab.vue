<script setup lang="ts">
import type { ProviderDescriptorDto } from '@shared/providers/descriptor'

interface Props {
  descriptors: ProviderDescriptorDto[]
  providerSettings: Record<string, Record<string, unknown>>
  testingProvider: string | null
  providerTestResult: Record<string, string>
}

interface Emits {
  (event: 'update:field', providerId: string, key: string, value: unknown): void
  (event: 'update:secret', providerId: string, key: string, value: string): void
  (event: 'test', providerId: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div class="space-y-8">
    <div
      v-for="descriptor in descriptors"
      :key="descriptor.id"
    >
      <h2 class="text-base font-semibold mb-4">
        {{ descriptor.displayName }}
      </h2>
      <p class="text-sm text-muted mb-4">
        {{ descriptor.description }}
      </p>
      <ProviderSettingsForm
        :provider-id="descriptor.id"
        :settings-fields="descriptor.settingsFields"
        :secret-fields="descriptor.secretFields"
        :current-settings="(providerSettings[descriptor.id] ?? {}) as Record<string, unknown>"
        @update:field="(key: string, val: unknown) => emit('update:field', descriptor.id, key, val)"
        @update:secret="(key: string, val: string) => emit('update:secret', descriptor.id, key, val)"
      />
      <div class="mt-4">
        <UButton
          size="sm"
          variant="soft"
          icon="i-fluent-plug-connected-24-regular"
          :loading="testingProvider === descriptor.id"
          :aria-label="`Test ${descriptor.displayName} connection`"
          @click="emit('test', descriptor.id)"
        >
          Test Connection
        </UButton>
        <span
          v-if="providerTestResult[descriptor.id]"
          class="ml-3 text-sm"
          :class="providerTestResult[descriptor.id]?.startsWith('OK') ? 'text-success' : 'text-error'"
        >
          {{ providerTestResult[descriptor.id] }}
        </span>
      </div>
    </div>
    <p
      v-if="descriptors.length === 0"
      class="text-dimmed"
    >
      No providers registered.
    </p>
  </div>
</template>
