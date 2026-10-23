// @vitest-environment happy-dom
import {
  afterEach, describe, expect, it, vi, type Mock,
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
    type TranslateFn = (input: unknown) => Promise<null>
    const translate: Mock<TranslateFn> = vi.fn<TranslateFn>(async () => null)
    const { useApi }: typeof UseApiModule = await loadUseApi({ translation: { translate } })
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
    type SelectFn = (file: File) => Promise<null>
    const selectDroppedFile: Mock<SelectFn> = vi.fn<SelectFn>(async () => null)
    const { useApi }: typeof UseApiModule = await loadUseApi({ documents: { selectDroppedFile } })
    const file: File = new File(['data'], 'notes.txt')

    await useApi().documents.selectDroppedFile(file)

    expect(selectDroppedFile.mock.calls[0]?.[0]).toBe(file)
  })
})
