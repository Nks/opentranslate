<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ProviderSettingsField, ProviderSecretField } from '@shared/providers/descriptor'
import type {
  SettingsPickFileFilter,
  SettingsPickFileValidation,
} from '@electron/ipc/channels'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'

interface Props {
  providerId: string
  settingsFields: readonly ProviderSettingsField[]
  secretFields: readonly ProviderSecretField[]
  currentSettings: Record<string, unknown>
}

interface Emits {
  'update:field': [key: string, value: unknown]
  'update:secret': [key: string, value: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const api = useApi()
const handleError = useHandleError()
const secretValues = ref<Record<string, string>>({})
const secretPresence = ref<Record<string, boolean>>({})
const fileFieldErrors = ref<Record<string, string>>({})
const pickingFor = ref<string | null>(null)

const FILE_PATH_FILTERS: readonly SettingsPickFileFilter[] = [
  {
    name: 'JSON',
    extensions: ['json'],
  },
]

function isFieldVisible(field: ProviderSettingsField): boolean {
  if (!field.dependsOn) {
    return true
  }

  return props.currentSettings[field.dependsOn.key] === field.dependsOn.equals
}

function getFieldValue(key: string): unknown {
  return props.currentSettings[key]
}

function onFieldChange(key: string, value: unknown): void {
  emit('update:field', key, value)
}

function onSecretChange(key: string, value: string): void {
  secretValues.value[key] = value
  emit('update:secret', key, value)
}

const visibleFields = computed<readonly ProviderSettingsField[]>(() =>
  props.settingsFields.filter(isFieldVisible),
)

const generalFields = computed<readonly ProviderSettingsField[]>(() =>
  visibleFields.value.filter((field) => field.group === 'general'),
)

const advancedFields = computed<readonly ProviderSettingsField[]>(() =>
  visibleFields.value.filter((field) => field.group === 'advanced'),
)

function clearFileError(key: string): void {
  if (fileFieldErrors.value[key] !== undefined) {
    delete fileFieldErrors.value[key]
  }
}

function applyFileValidation(
  key: string,
  validation: SettingsPickFileValidation | undefined,
): boolean {
  if (validation === undefined || validation.ok) {
    clearFileError(key)

    return true
  }
  fileFieldErrors.value[key] = validation.error ?? 'File validation failed.'

  return false
}

async function onBrowseFile(field: ProviderSettingsField): Promise<void> {
  if (pickingFor.value !== null) {
    return
  }
  pickingFor.value = field.key

  try {
    const response = await api.settings.pickFile({
      filters: FILE_PATH_FILTERS,
      ...(field.validate ? { validate: field.validate } : {}),
    })

    if (response.filePath === null) {
      return
    }
    const accepted: boolean = applyFileValidation(field.key, response.validation)

    if (accepted) {
      onFieldChange(field.key, response.filePath)
    }
  } catch (err: unknown) {
    handleError(err)
  } finally {
    pickingFor.value = null
  }
}

async function checkSecretPresence(): Promise<void> {
  try {
    const result = await api.secrets.test({ providerId: props.providerId })
    secretPresence.value[props.providerId] = result.present
  } catch {
    // Intentionally swallowed: this runs at mount time in unit tests
    // (and in non-Electron SSR contexts) where `api.secrets.test` rejects
    // because `window.api` isn't defined. The form must still render in
    // those environments. Real-Electron failures are surfaced when the
    // user interacts with secret fields, not during the eager probe.
  }
}

onMounted(() => {
  if (props.secretFields.length > 0) {
    void checkSecretPresence()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- General fields -->
    <div
      v-if="generalFields.length > 0"
      class="space-y-4"
    >
      <h3 class="text-sm font-medium text-default">
        General
      </h3>
      <div
        v-for="field in generalFields"
        :key="field.key"
      >
        <UFormField
          :label="field.label"
          :description="field.description"
          :error="fileFieldErrors[field.key]"
        >
          <USwitch
            v-if="field.type === 'boolean'"
            :model-value="Boolean(getFieldValue(field.key))"
            @update:model-value="(val: boolean) => onFieldChange(field.key, val)"
          />
          <USelect
            v-else-if="field.type === 'enum' && field.enumOptions"
            :model-value="String(getFieldValue(field.key) ?? '')"
            :items="field.enumOptions"
            value-key="value"
            label-key="label"
            :aria-label="field.label"
            @update:model-value="(val: string) => onFieldChange(field.key, val)"
          />
          <UInput
            v-else-if="field.type === 'number'"
            type="number"
            :model-value="String(getFieldValue(field.key) ?? '')"
            :placeholder="field.placeholder"
            :aria-label="field.label"
            @update:model-value="(val: string) => onFieldChange(field.key, Number(val))"
          />
          <div
            v-else-if="field.type === 'file-path'"
            class="flex gap-2"
          >
            <UInput
              :model-value="String(getFieldValue(field.key) ?? '')"
              :placeholder="field.placeholder ?? 'No file selected'"
              :aria-label="field.label"
              readonly
              class="flex-1"
            />
            <UButton
              variant="soft"
              icon="i-fluent-folder-open-24-regular"
              :disabled="pickingFor === field.key"
              @click="onBrowseFile(field)"
            >
              Browse…
            </UButton>
          </div>
          <UInput
            v-else
            :model-value="String(getFieldValue(field.key) ?? '')"
            :placeholder="field.placeholder"
            :aria-label="field.label"
            @update:model-value="(val: string) => onFieldChange(field.key, val)"
          />
        </UFormField>
      </div>
    </div>

    <!-- Secret fields -->
    <div
      v-if="secretFields.length > 0"
      class="space-y-4"
    >
      <h3 class="text-sm font-medium text-default">
        Credentials
      </h3>
      <div
        v-for="field in secretFields"
        :key="field.key"
      >
        <UFormField
          :label="field.label"
          :description="field.description"
        >
          <div class="flex gap-2">
            <UInput
              type="password"
              :model-value="secretValues[field.key] ?? ''"
              :placeholder="field.placeholder ?? 'Enter secret...'"
              :aria-label="field.label"
              class="flex-1"
              @update:model-value="(val: string) => onSecretChange(field.key, val)"
            />
            <span
              v-if="secretPresence[providerId]"
              class="text-xs text-success self-center"
            >
              Stored
            </span>
          </div>
        </UFormField>
      </div>
    </div>

    <!-- Advanced fields -->
    <div
      v-if="advancedFields.length > 0"
      class="space-y-4"
    >
      <h3 class="text-sm font-medium text-default">
        Advanced
      </h3>
      <div
        v-for="field in advancedFields"
        :key="field.key"
      >
        <UFormField
          :label="field.label"
          :description="field.description"
        >
          <USwitch
            v-if="field.type === 'boolean'"
            :model-value="Boolean(getFieldValue(field.key))"
            @update:model-value="(val: boolean) => onFieldChange(field.key, val)"
          />
          <UInput
            v-else-if="field.type === 'number'"
            type="number"
            :model-value="String(getFieldValue(field.key) ?? '')"
            :placeholder="field.placeholder"
            :aria-label="field.label"
            @update:model-value="(val: string) => onFieldChange(field.key, Number(val))"
          />
          <UInput
            v-else
            :model-value="String(getFieldValue(field.key) ?? '')"
            :placeholder="field.placeholder"
            :aria-label="field.label"
            @update:model-value="(val: string) => onFieldChange(field.key, val)"
          />
        </UFormField>
      </div>
    </div>
  </div>
</template>
