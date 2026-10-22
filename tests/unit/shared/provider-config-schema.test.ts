import {
  describe, expect, it,
} from 'vitest'
import {
  googleProviderSettingsSchema,
  libreTranslateProviderSettingsSchema,
  defaultGoogleProviderSettings,
  defaultLibreTranslateProviderSettings,
} from '@shared/schemas/provider-settings'

describe('googleProviderSettingsSchema', () => {
  it('accepts default google settings', () => {
    expect(googleProviderSettingsSchema.safeParse(defaultGoogleProviderSettings).success).toBe(true)
  })

  it('rejects unknown edition', () => {
    const bad = {
      ...defaultGoogleProviderSettings,
      edition: 'ultra',
    }
    expect(googleProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts advanced edition with location string', () => {
    const ok = {
      ...defaultGoogleProviderSettings,
      edition: 'advanced' as const,
      location: 'us-central1',
    }
    expect(googleProviderSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects non-positive request timeout', () => {
    const bad = {
      ...defaultGoogleProviderSettings,
      requestTimeoutMs: 0,
    }
    expect(googleProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('defaults authMode to service-account and apiKey to null', () => {
    expect(defaultGoogleProviderSettings.authMode).toBe('service-account')
    expect(defaultGoogleProviderSettings.apiKey).toBeNull()
  })

  it('accepts api-key authMode with a non-empty apiKey', () => {
    const ok = {
      ...defaultGoogleProviderSettings,
      authMode: 'api-key' as const,
      apiKey: 'AIza-test-key',
    }
    expect(googleProviderSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects unknown authMode', () => {
    const bad = {
      ...defaultGoogleProviderSettings,
      authMode: 'oauth-loopback',
    }
    expect(googleProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects empty apiKey string (use null instead)', () => {
    const bad = {
      ...defaultGoogleProviderSettings,
      apiKey: '',
    }
    expect(googleProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })
})

describe('libreTranslateProviderSettingsSchema', () => {
  it('accepts default libre settings', () => {
    expect(
      libreTranslateProviderSettingsSchema.safeParse(defaultLibreTranslateProviderSettings).success,
    ).toBe(true)
  })

  it('rejects non-http(s) endpoint', () => {
    const bad = {
      ...defaultLibreTranslateProviderSettings,
      endpoint: 'ftp://example.com',
    }
    expect(libreTranslateProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts null apiKey', () => {
    const ok = {
      ...defaultLibreTranslateProviderSettings,
      apiKey: null,
    }
    expect(libreTranslateProviderSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects empty apiKey string (use null instead)', () => {
    const bad = {
      ...defaultLibreTranslateProviderSettings,
      apiKey: '',
    }
    expect(libreTranslateProviderSettingsSchema.safeParse(bad).success).toBe(false)
  })
})
