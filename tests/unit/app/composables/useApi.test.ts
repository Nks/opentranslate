// @vitest-environment happy-dom
import {
  afterEach, describe, expect, it, vi,
} from 'vitest'
import type * as UseApiModule from '@app/composables/useApi'

async function loadUseApi(bridge: unknown): Promise<typeof UseApiModule> {
  vi.resetModules()
  ;(window as unknown as { api: unknown }).api = bridge

  return import('@app/composables/useApi')
}

describe('useApi argument serialization', () => {
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('strips reactive wrappers by JSON round-tripping plain arguments', async () => {
    const translate = vi.fn<(input: unknown) => Promise<null>>(async () => null)
    const { useApi } = await loadUseApi({ translation: { translate } })
    const input: Record<string, unknown> = {
      text: 'hi',
      skipped: undefined,
    }

    await useApi().translation.translate(input as never)

    const forwarded: unknown = translate.mock.calls[0]?.[0]
    expect(forwarded).toEqual({ text: 'hi' })
    expect(forwarded).not.toBe(input)
  })

  it('passes File objects through untouched so preload can resolve their path', async () => {
    const selectDroppedFile = vi.fn<(file: File) => Promise<null>>(async () => null)
    const { useApi } = await loadUseApi({ documents: { selectDroppedFile } })
    const file: File = new File(['data'], 'notes.txt')

    await useApi().documents.selectDroppedFile(file)

    expect(selectDroppedFile.mock.calls[0]?.[0]).toBe(file)
  })
})
