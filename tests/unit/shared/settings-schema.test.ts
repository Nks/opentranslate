import { describe, expect, it } from 'vitest';
import { appSettingsSchema, defaultAppSettings } from '@shared/schemas/settings';

describe('appSettingsSchema', () => {
  it('accepts default settings', () => {
    const result = appSettingsSchema.safeParse(defaultAppSettings);
    expect(result.success).toBe(true);
  });

  it('rejects unknown activeProvider', () => {
    const bad = { ...defaultAppSettings, activeProvider: 'deepl' };
    const result = appSettingsSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects invalid debounceMs', () => {
    const bad = { ...defaultAppSettings, debounceMs: -10 };
    expect(appSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid theme', () => {
    const bad = { ...defaultAppSettings, theme: 'neon' };
    expect(appSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts null defaultTargetLanguage', () => {
    const ok = { ...defaultAppSettings, defaultTargetLanguage: null };
    expect(appSettingsSchema.safeParse(ok).success).toBe(true);
  });

  it('parses shortcut sub-object', () => {
    const parsed = appSettingsSchema.parse(defaultAppSettings);
    expect(parsed.shortcuts.quickTranslateEnabled).toBe(true);
    expect(parsed.shortcuts.quickTranslate).toBeTruthy();
  });
});
