import {
  googleProviderSettingsSchema,
  defaultGoogleProviderSettings,
} from '@shared/schemas/provider-settings'
import {
  defineProvider,
} from '@shared/providers/descriptor'
import type {
  GoogleProviderSettings,
} from '@shared/types/provider-settings'
import {
  createGoogleAdapter,
} from '@electron/providers/google/adapter'

export const googleProviderDescriptor = defineProvider<GoogleProviderSettings>({
  id: 'google',
  displayName: 'Google Cloud Translation',
  description:
    'Official Google Cloud Translation API. Supports Basic and Advanced editions; ' +
    'Advanced is required for document translation.',
  settingsSchema: googleProviderSettingsSchema,
  defaultSettings: defaultGoogleProviderSettings,
  settingsFields: [
    {
      key: 'enabled',
      label: 'Enable Google Cloud Translation',
      type: 'boolean',
      required: false,
      group: 'general',
    },
    {
      key: 'projectId',
      label: 'Google Cloud project ID',
      description: 'The GCP project that owns the Translation API usage.',
      type: 'string',
      required: true,
      group: 'general',
      placeholder: 'my-gcp-project',
    },
    {
      key: 'credentialsJsonPath',
      label: 'Service account credentials (JSON file)',
      description:
        'Path to a service account JSON key file on this machine. The file is ' +
        'read only in the main process and never sent to the renderer.',
      type: 'file-path',
      required: true,
      group: 'general',
    },
    {
      key: 'edition',
      label: 'API edition',
      type: 'enum',
      enumOptions: [
        {
          value: 'basic',
          label: 'Basic (v2)',
        },
        {
          value: 'advanced',
          label: 'Advanced (v3) — required for documents',
        },
      ],
      required: true,
      group: 'general',
    },
    {
      key: 'location',
      label: 'Location (Advanced only)',
      description: 'The GCP location for Advanced API calls, e.g. "us-central1".',
      type: 'string',
      required: false,
      group: 'general',
      dependsOn: {
        key: 'edition',
        equals: 'advanced',
      },
    },
    {
      key: 'requestTimeoutMs',
      label: 'Request timeout (milliseconds)',
      type: 'number',
      required: true,
      group: 'advanced',
    },
  ],
  secretFields: [],
  createAdapter: (deps) => createGoogleAdapter(deps),
})
