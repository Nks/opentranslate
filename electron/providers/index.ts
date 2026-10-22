import {
  registerProvider,
  listProviders,
  getProvider,
  hasProvider,
  unregisterAllProviders,
} from '@electron/providers/registry'
import {
  googleProviderDescriptor,
} from '@electron/providers/google/descriptor'
import {
  libreTranslateProviderDescriptor,
} from '@electron/providers/libretranslate/descriptor'
import {
  toDescriptorDto,
} from '@shared/providers/descriptor'
import type {
  ProviderDescriptor, ProviderDescriptorDto,
} from '@shared/providers/descriptor'

/**
 * Provider registry barrel.
 *
 * To ship a new provider:
 *   1. Create `electron/providers/<id>/descriptor.ts` exporting a
 *      `ProviderDescriptor`.
 *   2. Import it here and add it to `shippedProviders`.
 *   3. Done — translation orchestration, settings, IPC handlers all pick it
 *      up automatically through the registry.
 */

const shippedProviders: readonly ProviderDescriptor[] = [
  googleProviderDescriptor,
  libreTranslateProviderDescriptor,
]

let bootstrapped = false

export function bootstrapProviderRegistry(): void {
  if (bootstrapped) {
    return
  }

  for (const descriptor of shippedProviders) {
    registerProvider(descriptor)
  }

  bootstrapped = true
}

export function resetProviderRegistryForTest(): void {
  unregisterAllProviders()
  bootstrapped = false
}

export function listProviderDtos(): readonly ProviderDescriptorDto[] {
  return listProviders().map(toDescriptorDto)
}

export {
  registerProvider,
  listProviders,
  getProvider,
  hasProvider,
  toDescriptorDto,
}
export type {
  ProviderDescriptor, ProviderDescriptorDto,
}
