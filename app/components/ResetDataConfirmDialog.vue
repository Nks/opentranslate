<script setup lang="ts">
interface Props {
  loading?: boolean
}

interface Emits {
  confirm: []
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<Emits>()

function onCancel() {
  open.value = false
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reset all local data?"
    :dismissible="!loading"
    :close="{
      disabled: loading,
    }"
  >
    <template #body>
      <p class="text-sm text-default">
        This will erase stored settings and the renderer cache
        (cached languages, last-used provider). Translation
        history and provider credentials in the OS keychain are
        not affected.
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="ghost"
          :disabled="props.loading"
          aria-label="Cancel reset"
          @click="onCancel"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          :loading="props.loading"
          aria-label="Confirm reset local data"
          @click="onConfirm"
        >
          Confirm
        </UButton>
      </div>
    </template>
  </UModal>
</template>
