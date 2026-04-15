import { describe, expect, it } from 'vitest';
import { isFeatureAvailable } from '@shared/capability-gate';
import type { ProviderReadiness } from '@shared/types/provider-readiness';
import type { ProviderCapabilities } from '@shared/types/capabilities';

const fullCaps: ProviderCapabilities = {
  textTranslation: true,
  languageDetection: true,
  supportedLanguagesDiscovery: true,
  documentTranslation: false,
};

const readyReadiness: ProviderReadiness = { state: 'ready', capabilities: fullCaps };

describe('isFeatureAvailable', () => {
  it('returns false when app feature flag disabled', () => {
    expect(isFeatureAvailable('textTranslation', readyReadiness, false)).toBe(false);
  });

  it('returns false when provider is unconfigured', () => {
    const readiness: ProviderReadiness = { state: 'unconfigured' };
    expect(isFeatureAvailable('textTranslation', readiness, true)).toBe(false);
  });

  it('returns false when provider configured but not yet ready', () => {
    const readiness: ProviderReadiness = { state: 'configured' };
    expect(isFeatureAvailable('textTranslation', readiness, true)).toBe(false);
  });

  it('returns true when ready + capability true + app enabled', () => {
    expect(isFeatureAvailable('textTranslation', readyReadiness, true)).toBe(true);
    expect(isFeatureAvailable('languageDetection', readyReadiness, true)).toBe(true);
    expect(isFeatureAvailable('supportedLanguagesDiscovery', readyReadiness, true)).toBe(true);
  });

  it('returns false when ready but capability flag false', () => {
    expect(isFeatureAvailable('documentTranslation', readyReadiness, true)).toBe(false);
  });

  it('carries unconfigured reason without affecting gate', () => {
    const readiness: ProviderReadiness = {
      state: 'unconfigured',
      reason: 'missing credentials',
    };
    expect(isFeatureAvailable('textTranslation', readiness, true)).toBe(false);
  });
});
