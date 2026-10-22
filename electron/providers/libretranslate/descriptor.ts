import {
  libreTranslateProviderSettingsSchema,
  defaultLibreTranslateProviderSettings,
} from '@shared/schemas/provider-settings'
import {
  defineProvider,
} from '@shared/providers/descriptor'
import type {
  LibreTranslateProviderSettings,
} from '@shared/types/provider-settings'
import {
  createLibreTranslateAdapter,
} from '@electron/providers/libretranslate/adapter'

export const libreTranslateProviderDescriptor = defineProvider<LibreTranslateProviderSettings>({
  id: 'libretranslate',
  displayName: 'LibreTranslate',
  description:
    'Open-source translation API. Works with the public libretranslate.com ' +
    'endpoint, a private deployment, or a local self-hosted instance.',
  settingsSchema: libreTranslateProviderSettingsSchema,
  defaultSettings: defaultLibreTranslateProviderSettings,
  settingsFields: [
    {
      key: 'enabled',
      label: 'Enable LibreTranslate',
      type: 'boolean',
      required: false,
      group: 'general',
    },
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      description: 'The base URL of the LibreTranslate instance to use.',
      type: 'url',
      required: true,
      group: 'general',
      placeholder: 'https://libretranslate.com',
    },
    {
      key: 'requestTimeoutMs',
      label: 'Request timeout (milliseconds)',
      type: 'number',
      required: true,
      group: 'advanced',
    },
    {
      key: 'allowSelfSignedTls',
      label: 'Allow self-signed TLS certificates',
      description:
        'Enable only for local/self-hosted deployments with a self-signed ' +
        'certificate. Leave off for public or private production endpoints.',
      type: 'boolean',
      required: false,
      group: 'advanced',
    },
  ],
  secretFields: [
    {
      key: 'apiKey',
      label: 'API key',
      description:
        'Optional. LibreTranslate public and self-hosted deployments may run ' +
        'without an API key; leave empty in that case.',
      placeholder: 'Leave empty for anonymous access',
      required: false,
    },
  ],
  createAdapter: (deps) => createLibreTranslateAdapter(deps),
})
