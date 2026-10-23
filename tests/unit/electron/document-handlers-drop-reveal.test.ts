import {
  describe, expect, it, vi,
} from 'vitest'
import type {
  DocumentService, DocumentTranslateResult,
} from '@electron/services/documents/service'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import {
  PICKED_REQUEST,
  TRANSLATED_OUTPUT_PATH,
  buildHandlers,
  fakeDialog,
  fakeService,
  type HandlerFixture,
} from './support/document-fakes'

describe('document handlers — drop', () => {
  it('registers a dropped path so it can be translated', async () => {
    const fixture: HandlerFixture = buildHandlers()

    expect(await fixture.handlers['document:drop']({ filePath: '/docs/report.txt' }))
      .toEqual({ filePath: '/docs/report.txt' })

    const result: DocumentTranslateResult = await fixture.handlers['document:translate'](
      PICKED_REQUEST,
    )
    expect(result.outputPath).toBe(TRANSLATED_OUTPUT_PATH)
  })

  it('replaces the previously picked file', async () => {
    const service: DocumentService = fakeService()
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    })
    await fixture.handlers['document:pick']()
    await fixture.handlers['document:drop']({ filePath: '/docs/other.txt' })

    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
    })
    expect(service.translate).not.toHaveBeenCalled()
  })

  it.each([null, {}, { filePath: '' }, {
    filePath: '/docs/a.txt',
    extra: 1,
  }])(
    'rejects malformed drop payload %j without registering it',
    async (payload: unknown) => {
      const fixture: HandlerFixture = buildHandlers({
        showOpenDialog: fakeDialog(['/docs/report.txt']),
      })
      await fixture.handlers['document:pick']()

      await expect(fixture.handlers['document:drop'](payload)).rejects.toMatchObject({
        category: ErrorCategory.InternalAppError,
        message: expect.stringContaining('invalid request'),
      })
      await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).resolves.toMatchObject({
        outputPath: TRANSLATED_OUTPUT_PATH,
      })
    },
  )
})

describe('document handlers — selection checks', () => {
  const rejection: AppError = new AppError(
    ErrorCategory.UnsupportedDocumentType,
    'document: unsupported file type ".pdf" — Supported formats: .txt',
  )

  it('validates a dropped file in main and keeps the previous selection on failure', async () => {
    const service: DocumentService = fakeService()
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    })
    await fixture.handlers['document:pick']()
    vi.mocked(service.inspect).mockRejectedValueOnce(rejection)

    await expect(fixture.handlers['document:drop']({ filePath: '/docs/report.pdf' }))
      .rejects.toBe(rejection)

    expect(service.inspect).toHaveBeenLastCalledWith('/docs/report.pdf')
    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).resolves.toMatchObject({
      outputPath: TRANSLATED_OUTPUT_PATH,
    })
  })

  it('validates a picked file in main before allowlisting it', async () => {
    const service: DocumentService = fakeService()
    vi.mocked(service.inspect).mockRejectedValueOnce(rejection)
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    })

    await expect(fixture.handlers['document:pick']()).rejects.toBe(rejection)
    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
    })
    expect(service.translate).not.toHaveBeenCalled()
  })
})

describe('document handlers — reveal', () => {
  it('reveals the last output path main produced', async () => {
    const showItemInFolder = vi.fn<(fullPath: string) => void>()
    const fixture: HandlerFixture = buildHandlers({
      showOpenDialog: fakeDialog(['/docs/report.txt']),
      showItemInFolder,
    })
    await fixture.handlers['document:pick']()
    await fixture.handlers['document:translate'](PICKED_REQUEST)

    await fixture.handlers['document:reveal']()

    expect(showItemInFolder).toHaveBeenCalledWith(TRANSLATED_OUTPUT_PATH)
  })

  it('refuses to reveal before any translation finished', async () => {
    const showItemInFolder = vi.fn<(fullPath: string) => void>()
    const fixture: HandlerFixture = buildHandlers({ showItemInFolder })

    await expect(fixture.handlers['document:reveal']()).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
      message: expect.stringContaining('no translated file'),
    })
    expect(showItemInFolder).not.toHaveBeenCalled()
  })

  it('ignores any argument and never reveals a renderer-supplied path', async () => {
    const showItemInFolder = vi.fn<(fullPath: string) => void>()
    const fixture: HandlerFixture = buildHandlers({
      showOpenDialog: fakeDialog(['/docs/report.txt']),
      showItemInFolder,
    })
    await fixture.handlers['document:pick']()
    await fixture.handlers['document:translate'](PICKED_REQUEST)
    const reveal = fixture.handlers['document:reveal'] as (input?: unknown) => Promise<void>

    await reveal({ outputPath: '/etc/passwd' })

    expect(showItemInFolder).toHaveBeenCalledWith(TRANSLATED_OUTPUT_PATH)
  })

  it('keeps the previous output when a later translation fails', async () => {
    const service: DocumentService = fakeService()
    const showItemInFolder = vi.fn<(fullPath: string) => void>()
    const fixture: HandlerFixture = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
      showItemInFolder,
    })
    await fixture.handlers['document:pick']()
    await fixture.handlers['document:translate'](PICKED_REQUEST)
    vi.mocked(service.translate).mockRejectedValueOnce(new Error('boom'))
    await expect(fixture.handlers['document:translate'](PICKED_REQUEST)).rejects.toThrow('boom')

    await fixture.handlers['document:reveal']()

    expect(showItemInFolder).toHaveBeenCalledWith(TRANSLATED_OUTPUT_PATH)
  })
})
