import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'

/**
 * Runtime provider registry.
 *
 * The registry is process-local state in the Electron main process. It is
 * populated at startup by `bootstrapProviderRegistry()` in `./index.ts`,
 * which imports every shipped provider descriptor. Future providers only
 * need to add an entry to that barrel — translation orchestration,
 * settings, and IPC handler code consume providers through this registry
 * and do not know any provider by name.
 */

const descriptors = new Map<string, ProviderDescriptor>()

export function registerProvider(descriptor: ProviderDescriptor): void {
  if (descriptors.has(descriptor.id)) {
    throw new Error(`provider "${descriptor.id}" is already registered`)
  }

  // The current secrets vault keys plaintext by `providerId` alone (see
  // `electron/services/secrets/vault.ts`). If a descriptor declares more
  // than one secret field, only one slot would survive — the adapter's
  // `getSecret(fieldKey)` callback would silently return the wrong value
  // for every secret beyond the first. Reject at registration time until
  // multi-secret storage lands (backlog B-G-16).
  if (descriptor.secretFields.length > 1) {
    throw new Error(
      `provider "${descriptor.id}" declares ${descriptor.secretFields.length} secret ` +
      'fields, but the secrets vault currently stores one secret per provider. ' +
      'See backlog B-G-16 for the multi-secret refactor.',
    )
  }

  descriptors.set(descriptor.id, descriptor)
}

export function getProvider(id: string): ProviderDescriptor | undefined {
  return descriptors.get(id)
}

export function listProviders(): readonly ProviderDescriptor[] {
  return [...descriptors.values()]
}

export function hasProvider(id: string): boolean {
  return descriptors.has(id)
}

export function unregisterAllProviders(): void {
  descriptors.clear()
}
