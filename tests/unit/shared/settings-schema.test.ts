import {
  describe, expect, it,
} from 'vitest'
import {
  appSettingsSchema, defaultAppSettings,
} from '@shared/schemas/settings'
import {
  DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
  parseQuickTranslateShortcut,
} from '@shared/shortcuts/quick-translate'

describe('appSettingsSchema', () => {
  it('accepts default settings', () => {
    const result = appSettingsSchema.safeParse(defaultAppSettings)
    expect(result.success).toBe(true)
  })

  it('rejects unknown activeProvider', () => {
    const bad = {
      ...defaultAppSettings,
      activeProvider: 'deepl',
    }
    const result = appSettingsSchema.safeParse(bad)
    expect(result.success).toBe(false)
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

  it('resolves the default quick-translate to ⌘ on macOS', () => {
    const parsed = parseQuickTranslateShortcut(
      defaultAppSettings.shortcuts.quickTranslate,
      'darwin',
    )
    expect(parsed.modifier).toBe('meta')
    expect(parsed.key).toBe('C')
    expect(parsed.chord).toBe('double')
  })

  it('resolves the default quick-translate to Ctrl on Windows', () => {
    const parsed = parseQuickTranslateShortcut(
      defaultAppSettings.shortcuts.quickTranslate,
      'win32',
    )
    expect(parsed.modifier).toBe('ctrl')
    expect(parsed.chord).toBe('double')
  })

  it('resolves the default quick-translate to Ctrl on Linux', () => {
    const parsed = parseQuickTranslateShortcut(
      defaultAppSettings.shortcuts.quickTranslate,
      'linux',
    )
    expect(parsed.modifier).toBe('ctrl')
    expect(parsed.chord).toBe('double')
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
})
