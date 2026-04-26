<script setup lang="ts">
import { ref } from 'vue'
import type { AdvancedSettings } from '@shared/types/settings'
import { useResetLocalData } from '@app/composables/useResetLocalData'

interface Props {
  advanced: AdvancedSettings
}

interface Emits {
  (event: 'update:advanced', value: AdvancedSettings): void
  (event: 'reset-complete'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { resetLocalData } = useResetLocalData()

const resetModalOpen = ref<boolean>(false)
const resetting = ref<boolean>(false)

function onTimeoutChange(raw: string): void {
  emit('update:advanced', {
    ...props.advanced,
    requestTimeoutMs: Number(raw),
  })
}

async function confirmReset(): Promise<void> {
  resetting.value = true
  const ok: boolean = await resetLocalData()

  if (ok) {
    resetModalOpen.value = false
    emit('reset-complete')
  }

  resetting.value = false
}
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Request timeout (ms)">
      <UInput
        type="number"
        :model-value="String(advanced.requestTimeoutMs)"
        aria-label="Request timeout"
        @update:model-value="onTimeoutChange"
      />
    </UFormField>

    <div class="pt-4 border-t border-default">
      <UButton
        color="error"
        variant="ghost"
        size="sm"
        aria-label="Reset all local data"
        @click="resetModalOpen = true"
      >
        Reset Local Data
      </UButton>
      <p class="text-xs text-dimmed mt-1">
        Clears stored settings and the renderer cache.
        Translation history and credentials in the OS
        keychain are not affected.
      </p>
    </div>

    <ResetDataConfirmDialog
      v-model="resetModalOpen"
      :loading="resetting"
      @confirm="confirmReset"
    />
  </div>
</template>
