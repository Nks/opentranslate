import {
  describe, expect, it, beforeEach, afterEach,
} from 'vitest'
import { z } from 'zod'
import {
  defineProvider,
} from '@shared/providers/descriptor'
import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'
import {
  registerProvider,
  unregisterAllProviders,
  hasProvider,
} from '@electron/providers/registry'

interface FakeSettings {
  enabled: boolean
}

function buildDescriptor(secretFieldCount: number): ProviderDescriptor {
  return defineProvider<FakeSettings>({
    id: `fake-${secretFieldCount}`,
    displayName: 'Fake',
    description: 'fake',
    settingsSchema: z.object({ enabled: z.boolean() }),
    defaultSettings: { enabled: true },
    settingsFields: [],
    secretFields: Array.from({ length: secretFieldCount }, (_, index: number) => ({
      key: `secret_${index}`,
      label: `Secret ${index}`,
      required: false,
    })),
    createAdapter: () => ({
      id: 'libretranslate',
      getHealth: async () => ({ ok: true }),
      getSupportedLanguages: async () => [],
      detectLanguage: async () => ({
        detectedLanguage: 'en',
        confidence: 1,
      }),
      translateText: async () => ({
        translatedText: '',
        provider: 'libretranslate',
      }),
      supportsDocumentTranslation: async () => false,
      getCapabilities: async () => ({
        textTranslation: true,
        languageDetection: true,
        supportedLanguagesDiscovery: true,
        documentTranslation: false,
      }),
    }),
  })
}

describe('registerProvider — multi-secret guard', () => {
  beforeEach(() => {
    unregisterAllProviders()
  })

  afterEach(() => {
    unregisterAllProviders()
  })

  it('accepts a descriptor with zero secret fields', () => {
    expect(() => registerProvider(buildDescriptor(0))).not.toThrow()
    expect(hasProvider('fake-0')).toBe(true)
  })

  it('accepts a descriptor with exactly one secret field', () => {
    expect(() => registerProvider(buildDescriptor(1))).not.toThrow()
    expect(hasProvider('fake-1')).toBe(true)
  })

  it('rejects a descriptor that declares two secret fields', () => {
    expect(() => registerProvider(buildDescriptor(2))).toThrow(/multi-secret/i)
    expect(hasProvider('fake-2')).toBe(false)
  })

  it('rejects a descriptor with many secret fields', () => {
    expect(() => registerProvider(buildDescriptor(5))).toThrow(/B-G-16/)
  })
})
