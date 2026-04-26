<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ProviderSettingsField, ProviderSecretField } from '@shared/providers/descriptor'
import { useApi } from '@app/composables/useApi'

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
const secretValues = ref<Record<string, string>>({})
const secretPresence = ref<Record<string, boolean>>({})

function isFieldVisible(field: ProviderSettingsField): boolean {
  if (!field.dependsOn) {
    return true
  }

  return props.currentSettings[field.dependsOn.key] === field.dependsOn.equals
}

function getFieldValue(key: string): unknown {
  return props.currentSettings[key]
}

function onFieldChange(key: string, value: unknown) {
  emit('update:field', key, value)
}

function onSecretChange(key: string, value: string) {
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

async function checkSecretPresence() {
  try {
    const result = await api.secrets.test({ providerId: props.providerId })
    secretPresence.value[props.providerId] = result.present
  } catch {
    // outside Electron
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
