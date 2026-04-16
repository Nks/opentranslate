import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  bootstrapProviderRegistry,
  listProviders,
  listProviderDtos,
  getProvider,
  hasProvider,
  registerProvider,
  resetProviderRegistryForTest,
} from '@electron/providers'
import {
  toDescriptorDto,
} from '@shared/providers/descriptor'
import type {
  ProviderDescriptor,
} from '@shared/providers/descriptor'
import {
  z,
} from 'zod'

function makeFakeDescriptor(id: string): ProviderDescriptor {
  return {
    id,
    displayName: `Fake ${id}`,
    description: 'test',
    settingsSchema: z.object({
      enabled: z.boolean(),
    }),
    defaultSettings: {
      enabled: false,
    },
    settingsFields: [
      {
        key: 'enabled',
        label: 'Enable',
        type: 'boolean',
        required: false,
        group: 'general',
      },
    ],
    secretFields: [],
    createAdapter: () => {
      throw new Error('no adapter in test')
    },
  }
}

describe('provider registry', () => {
  beforeEach(() => {
    resetProviderRegistryForTest()
  })

  it('bootstraps with google + libretranslate shipped providers', () => {
    bootstrapProviderRegistry()
    const ids = listProviders().map((descriptor) => descriptor.id)

    expect(ids).toContain('google')
    expect(ids).toContain('libretranslate')
    expect(ids.length).toBe(2)
  })

  it('is idempotent when bootstrapped twice', () => {
    bootstrapProviderRegistry()
    bootstrapProviderRegistry()

    expect(listProviders().length).toBe(2)
  })

  it('rejects a duplicate registration', () => {
    bootstrapProviderRegistry()

    expect(() => registerProvider(makeFakeDescriptor('google'))).toThrow(/already registered/)
  })

  it('allows a new provider to be registered without touching core code', () => {
    bootstrapProviderRegistry()
    registerProvider(makeFakeDescriptor('experimental'))

    expect(hasProvider('experimental')).toBe(true)
    expect(getProvider('experimental')?.displayName).toBe('Fake experimental')
  })

  it('exposes serializable DTOs suitable for IPC', () => {
    bootstrapProviderRegistry()
    const dtos = listProviderDtos()

    expect(dtos.length).toBe(2)

    for (const dto of dtos) {
      expect(dto).toHaveProperty('id')
      expect(dto).toHaveProperty('displayName')
      expect(dto).toHaveProperty('settingsFields')
      expect(dto).toHaveProperty('secretFields')
      // Non-serializable members MUST NOT appear on the DTO
      expect(dto).not.toHaveProperty('settingsSchema')
      expect(dto).not.toHaveProperty('createAdapter')
      expect(dto).not.toHaveProperty('defaultSettings')
    }
  })

  it('each shipped descriptor matches its own Zod schema when given its default settings', () => {
    bootstrapProviderRegistry()

    for (const descriptor of listProviders()) {
      const result = descriptor.settingsSchema.safeParse(descriptor.defaultSettings)
      expect(result.success).toBe(true)
    }
  })

  it('toDescriptorDto strips internals', () => {
    const descriptor = makeFakeDescriptor('x')
    const dto = toDescriptorDto(descriptor)

    expect(Object.keys(dto).sort()).toEqual(
      ['description', 'displayName', 'id', 'secretFields', 'settingsFields'].sort(),
    )
  })
})
