import type { ProviderCapabilities } from './capabilities.js';

export type ProviderReadiness =
  | { state: 'unconfigured'; reason?: string }
  | { state: 'configured' }
  | { state: 'ready'; capabilities: ProviderCapabilities };
