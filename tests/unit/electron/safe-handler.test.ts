import {
  describe, expect, it,
} from 'vitest'
import {
  safeHandler,
} from '@electron/services/ipc/safe-handler'

class ProviderFailure extends Error {
  readonly category: string = 'auth'

  constructor(message: string, readonly rawBody: string) {
    super(message)
    this.name = 'ProviderFailure'
  }
}

function failingWith(error: unknown): () => Promise<never> {
  return async (): Promise<never> => {
    throw error
  }
}

async function caughtFrom(handler: () => Promise<unknown>): Promise<Error> {
  const rejection: unknown = await handler().then(
    (): null => null,
    (err: unknown): unknown => err,
  )

  expect(rejection).toBeInstanceOf(Error)

  return rejection as Error
}

describe('safeHandler', () => {
  it('resolves with the wrapped handler result', async () => {
    const handler: (value: number) => Promise<number> = safeHandler(
      (value: number): number => value * 2,
    )

    await expect(handler(21)).resolves.toBe(42)
  })

  it('rethrows a plain Error carrying the category and message', async () => {
    const error: Error = await caughtFrom(safeHandler(failingWith(new ProviderFailure('bad key', 'secret-body'))))

    expect(error.constructor).toBe(Error)
    expect(error.message).toBe('[auth] ProviderFailure: bad key')
  })

  it('never chains the raw provider error as cause across the IPC boundary', async () => {
    const error: Error = await caughtFrom(safeHandler(failingWith(new ProviderFailure('bad key', 'secret-body'))))

    expect(error.cause).toBeUndefined()
    expect(Object.hasOwn(error, 'cause')).toBe(false)
    expect(globalThis.structuredClone(error).cause).toBeUndefined()
  })

  it('omits the stack trace outside dev mode', async () => {
    const error: Error = await caughtFrom(safeHandler(failingWith(new ProviderFailure('bad key', 'secret-body'))))

    expect(error.message).not.toContain('\n')
  })

  it('appends the stack trace in dev mode', async () => {
    const error: Error = await caughtFrom(
      safeHandler(failingWith(new ProviderFailure('bad key', 'secret-body')), true),
    )

    expect(error.message).toMatch(/^\[auth\] ProviderFailure: bad key\n.*ProviderFailure/s)
  })

  it('stringifies non-Error throws under the unknown category', async () => {
    const error: Error = await caughtFrom(safeHandler(failingWith('boom')))

    expect(error.message).toBe('[unknown] boom')
    expect(error.cause).toBeUndefined()
  })
})
