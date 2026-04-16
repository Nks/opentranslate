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
