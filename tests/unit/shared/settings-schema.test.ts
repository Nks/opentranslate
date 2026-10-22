import {
  describe, expect, it,
} from 'vitest'
import {
  appSettingsSchema, defaultAppSettings,
} from '@shared/schemas/settings'
import {
  DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
} from '@shared/shortcuts/quick-translate'

describe('appSettingsSchema', () => {
  it('accepts default settings', () => {
    const result = appSettingsSchema.safeParse(defaultAppSettings)
    expect(result.success).toBe(true)
  })

  it('accepts a structured activeProvider selection', () => {
    const ok = {
      ...defaultAppSettings,
      activeProvider: {
        providerId: 'google',
        sourceSelection: {
          mode: 'explicit',
          code: 'en',
        },
        targetLanguage: 'fr',
      },
    }
    expect(appSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects activeProvider when it is a bare string (legacy shape)', () => {
    const bad = {
      ...defaultAppSettings,
      activeProvider: 'google',
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an explicit source selection with an empty code', () => {
    const bad = {
      ...defaultAppSettings,
      activeProvider: {
        providerId: 'google',
        sourceSelection: {
          mode: 'explicit',
          code: '',
        },
        targetLanguage: null,
      },
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid debounceMs', () => {
    const bad = {
      ...defaultAppSettings,
      debounceMs: -10,
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid theme', () => {
    const bad = {
      ...defaultAppSettings,
      theme: 'neon',
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts null defaultTargetLanguage', () => {
    const ok = {
      ...defaultAppSettings,
      defaultTargetLanguage: null,
    }
    expect(appSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('parses shortcut sub-object', () => {
    const parsed = appSettingsSchema.parse(defaultAppSettings)
    expect(parsed.shortcuts.quickTranslateEnabled).toBe(true)
    expect(parsed.shortcuts.quickTranslate).toBeTruthy()
  })

  it('defaults quickTranslate to the platform-aware accelerator token', () => {
    expect(defaultAppSettings.shortcuts.quickTranslate).toBe(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
    )
  })

  it('rejects a quick-translate shortcut without a modifier', () => {
    const bad = {
      ...defaultAppSettings,
      shortcuts: {
        ...defaultAppSettings.shortcuts,
        quickTranslate: 'Q',
      },
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a chord shortcut with mismatched trailing keys', () => {
    const bad = {
      ...defaultAppSettings,
      shortcuts: {
        ...defaultAppSettings.shortcuts,
        quickTranslate: 'Ctrl+C+V',
      },
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts a custom single-press shortcut with modifiers', () => {
    const ok = {
      ...defaultAppSettings,
      shortcuts: {
        ...defaultAppSettings.shortcuts,
        quickTranslate: 'Ctrl+Shift+T',
      },
    }
    expect(appSettingsSchema.safeParse(ok).success).toBe(true)
  })

  it('defaults targetHistory to an empty array', () => {
    expect(defaultAppSettings.targetHistory).toEqual([])
  })

  it('accepts up to five targetHistory entries', () => {
    const ok = {
      ...defaultAppSettings,
      targetHistory: ['ru', 'es', 'en', 'de', 'fr'],
    }
    const result = appSettingsSchema.safeParse(ok)
    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.targetHistory).toEqual(['ru', 'es', 'en', 'de', 'fr'])
    }
  })

  it('trims targetHistory longer than five entries to the first five', () => {
    const oversized = {
      ...defaultAppSettings,
      targetHistory: ['ru', 'es', 'en', 'de', 'fr', 'it', 'ja'],
    }
    const result = appSettingsSchema.safeParse(oversized)
    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.targetHistory).toEqual(['ru', 'es', 'en', 'de', 'fr'])
    }
  })

  it('deduplicates targetHistory entries preserving first-occurrence order', () => {
    const dupes = {
      ...defaultAppSettings,
      targetHistory: ['ru', 'es', 'ru', 'en', 'es', 'de'],
    }
    const result = appSettingsSchema.safeParse(dupes)
    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.targetHistory).toEqual(['ru', 'es', 'en', 'de'])
    }
  })

  it('rejects targetHistory containing an empty string entry', () => {
    const bad = {
      ...defaultAppSettings,
      targetHistory: ['ru', ''],
    }
    expect(appSettingsSchema.safeParse(bad).success).toBe(false)
  })
})
