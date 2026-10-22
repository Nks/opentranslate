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
    'Official Google Cloud Translation API. Supports Basic (v2) and Advanced (v3) ' +
    'editions; Advanced is required for document translation. Authentication is ' +
    'either a service-account JSON key or a v2 API key.',
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
      key: 'authMode',
      label: 'Authentication',
      description:
        'How to authenticate with the Cloud Translation API. Service-account ' +
        'unlocks Basic + Advanced; API key is v2 Basic only.',
      type: 'enum',
      enumOptions: [
        {
          value: 'service-account',
          label: 'Service account JSON',
        },
        {
          value: 'api-key',
          label: 'API key (Basic / v2 only)',
        },
      ],
      required: true,
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
      dependsOn: {
        key: 'authMode',
        equals: 'service-account',
      },
      validate: 'google-service-account',
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
      dependsOn: {
        key: 'authMode',
        equals: 'service-account',
      },
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
  secretFields: [
    {
      key: 'apiKey',
      label: 'Google Cloud API key',
      description:
        'Only used when Authentication is set to "API key". Basic/v2 only — ' +
        'document translation is unavailable in this mode.',
      placeholder: 'AIza…',
      required: false,
    },
  ],
  createAdapter: (deps) => createGoogleAdapter(deps),
})
