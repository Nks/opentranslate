<script setup lang="ts">
import { ref } from 'vue'

type Choice = 'hide' | 'quit' | 'cancel'

interface Emits {
  choose: [payload: {
    choice: Choice
    remember: boolean
  }]
}

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<Emits>()
const remember = ref<boolean>(false)
let choiceMade: boolean = false

function emitChoice(choice: Choice): void {
  choiceMade = true
  emit('choose', {
    choice,
    remember: remember.value,
  })
}

function onHide(): void {
  emitChoice('hide')
}

function onQuit(): void {
  emitChoice('quit')
}

function onOpenChange(nextOpen: boolean): void {
  if (nextOpen) {
    choiceMade = false
    open.value = true

    return
  }
  open.value = false

  if (choiceMade) {
    choiceMade = false

    return
  }
  // Dismissal without a button click (Esc/backdrop) cancels the close;
  // main keeps the pending close gate clear and the window stays open.
  emit('choose', {
    choice: 'cancel',
    remember: false,
  })
}
</script>

<template>
  <UModal
    :open="open"
    title="Hide to tray or quit?"
    :dismissible="true"
    @update:open="onOpenChange"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-default">
          OpenTranslate keeps a system-tray icon for quick access.
          Closing the window can either keep the app running in the
          tray or quit entirely.
        </p>
        <UCheckbox
          v-model="remember"
          label="Remember this choice"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="ghost"
          icon="i-fluent-window-arrow-up-24-regular"
          aria-label="Hide window to tray"
          @click="onHide"
        >
          Hide to tray
        </UButton>
        <UButton
          color="error"
          icon="i-fluent-power-24-regular"
          aria-label="Quit OpenTranslate"
          @click="onQuit"
        >
          Quit
        </UButton>
      </div>
    </template>
  </UModal>
</template>
