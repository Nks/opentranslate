import type { ProviderCapabilities } from './types/capabilities.js';
import type { ProviderReadiness } from './types/provider-readiness.js';

export type FeatureKey = keyof ProviderCapabilities;

export function isFeatureAvailable(
  feature: FeatureKey,
  readiness: ProviderReadiness,
  appEnabled: boolean,
): boolean {
  if (!appEnabled) return false;
  if (readiness.state !== 'ready') return false;
  return readiness.capabilities[feature] === true;
}
