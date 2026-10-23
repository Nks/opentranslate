import {
  describe, expect, it, vi,
} from 'vitest'
import type { DocumentSelection } from '@electron/services/documents/handlers'
import type { DocumentService } from '@electron/services/documents/service'
import { ErrorCategory } from '@shared/errors'
import type { TranslationProvider } from '@shared/providers/contract'
import {
  ACTIVE_ADAPTER,
  PICKED_REQUEST,
  buildHandlers,
  fakeDialog,
  fakeService,
  type HandlerFixture,
} from './support/document-fakes'

describe('document handlers — selection', () => {
  it('returns the name and extension main resolved for the picked file', async () => {
    const fixture: HandlerFixture = buildHandlers({
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    })

    const selection: DocumentSelection | null = await fixture.handlers['document:pick']()

    expect(selection).toEqual({
      filePath: '/docs/report.txt',
      fileName: 'report.txt',
      extension: '.txt',
    })
  })

  it('keeps the selection for further translations with the same provider', async () => {
    const fixture: HandlerFixture = buildHandlers({
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    })
    await fixture.handlers['document:pick']()

    await fixture.handlers['document:translate'](PICKED_REQUEST)
    await fixture.handlers['document:translate']({
      ...PICKED_REQUEST,
      targetLanguage: 'de',
    })

    expect(fixture.service.translate).toHaveBeenCalledTimes(2)
  })

  it('refuses the selection once the active provider changed', async () => {
    let activeAdapter: TranslationProvider = ACTIVE_ADAPTER
    const service: DocumentService = fakeService()
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
      getAdapter: (): TranslationProvider => activeAdapter,
    })
    await fixture.handlers['document:pick']()
    activeAdapter = { id: 'libretranslate' } as TranslationProvider

    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
      message: expect.stringContaining('provider changed'),
    })
    expect(service.translate).not.toHaveBeenCalled()
  })

  it('refuses a selection whose provider changed while main was checking the file', async () => {
    let activeAdapter: TranslationProvider = ACTIVE_ADAPTER
    const service: DocumentService = fakeService()
    const inspectFile: DocumentService['inspect'] = service.inspect
    vi.mocked(service.inspect).mockImplementationOnce(async (filePath: string) => {
      activeAdapter = { id: 'libretranslate' } as TranslationProvider

      return inspectFile(filePath)
    })
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
      getAdapter: (): TranslationProvider => activeAdapter,
    })

    await expect(fixture.handlers['document:pick']()).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
      message: expect.stringContaining('provider changed'),
    })
    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      message: expect.stringContaining('not selected through the document picker'),
    })
  })

  it('refuses a drop registered before the provider changed', async () => {
    let activeAdapter: TranslationProvider = ACTIVE_ADAPTER
    const fixture: HandlerFixture = buildHandlers({
      getAdapter: (): TranslationProvider => activeAdapter,
    })
    await fixture.handlers['document:drop']({ filePath: '/docs/report.txt' })
    activeAdapter = { id: 'libretranslate' } as TranslationProvider

    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      message: expect.stringContaining('provider changed'),
    })
  })
})
