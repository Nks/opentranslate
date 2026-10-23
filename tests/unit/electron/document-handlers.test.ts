import {
  describe, expect, it, vi, type Mock,
} from 'vitest'
import type {
  DocumentHandlers,
  DocumentOpenDialog,
  DocumentSelection,
} from '@electron/services/documents/handlers'
import type {
  DocumentService, DocumentTranslateResult,
} from '@electron/services/documents/service'
import { ErrorCategory } from '@shared/errors'
import {
  PICKED_REQUEST,
  SUPPORTED_STATUS,
  buildHandlers,
  fakeDialog,
  fakeService,
} from './support/document-fakes'

describe('document handlers — translate', () => {
  it('validates the payload and forwards the picked file to the service', async () => {
    const service: DocumentService = fakeService()
    const handlers: DocumentHandlers = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    }).handlers
    await handlers['document:pick']()

    const result: DocumentTranslateResult = await handlers['document:translate'](PICKED_REQUEST)

    expect(service.translate).toHaveBeenCalledWith(PICKED_REQUEST)
    expect(result.outputPath).toBe('/docs/report.ru.translated.txt')
  })

  it('refuses a path that did not come from the document picker', async () => {
    const service: DocumentService = fakeService()
    const handlers: DocumentHandlers = buildHandlers({
      service,
      showOpenDialog: fakeDialog(['/docs/report.txt']),
    }).handlers
    await handlers['document:pick']()

    await expect(handlers['document:translate']({
      ...PICKED_REQUEST,
      filePath: '/Users/me/secrets.txt',
    })).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
      message: expect.stringContaining('document picker'),
    })
    expect(service.translate).not.toHaveBeenCalled()
  })

  it('refuses any path before a file was picked', async () => {
    const service: DocumentService = fakeService()
    const handlers: DocumentHandlers = buildHandlers({
      service,
      showOpenDialog: fakeDialog([]),
    }).handlers

    await expect(handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
    })
    expect(service.translate).not.toHaveBeenCalled()
  })

  it('only trusts the most recent pick', async () => {
    const service: DocumentService = fakeService()
    const showOpenDialog: Mock<DocumentOpenDialog> = vi.fn<DocumentOpenDialog>()
      .mockResolvedValueOnce({
        canceled: false,
        filePaths: ['/docs/report.txt'],
      })
      .mockResolvedValueOnce({
        canceled: false,
        filePaths: ['/docs/other.txt'],
      })
    const handlers: DocumentHandlers = buildHandlers({
      service,
      showOpenDialog,
    }).handlers
    await handlers['document:pick']()
    await handlers['document:pick']()

    await expect(handlers['document:translate'](PICKED_REQUEST)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
    })
  })

  it.each([
    null,
    'report.txt',
    {
      filePath: '/docs/report.txt',
      sourceLanguage: { mode: 'auto' },
      targetLanguage: '../../evil',
    },
    {
      filePath: '/docs/report.txt',
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
      outputPath: '/etc/passwd',
    },
  ])('rejects malformed payload %j before touching the service', async (payload: unknown) => {
    const service: DocumentService = fakeService()
    const handlers: DocumentHandlers = buildHandlers({
      service,
      showOpenDialog: fakeDialog([]),
    }).handlers

    await expect(handlers['document:translate'](payload)).rejects.toMatchObject({
      category: ErrorCategory.InternalAppError,
      message: expect.stringContaining('invalid request'),
    })
    expect(service.translate).not.toHaveBeenCalled()
  })
})

describe('document handlers — status', () => {
  it('returns the service status', async () => {
    const handlers: DocumentHandlers = buildHandlers({
      service: fakeService(),
      showOpenDialog: fakeDialog([]),
    }).handlers

    expect(await handlers['document:status']()).toEqual(SUPPORTED_STATUS)
  })
})

describe('document handlers — pick', () => {
  it('filters the native dialog by the provider formats', async () => {
    const showOpenDialog: DocumentOpenDialog = fakeDialog(['/docs/report.pdf'])
    const handlers: DocumentHandlers = buildHandlers({
      service: fakeService(),
      showOpenDialog,
    }).handlers

    const picked: DocumentSelection | null = await handlers['document:pick']()

    expect(picked).toEqual({
      filePath: '/docs/report.pdf',
      fileName: 'report.pdf',
      extension: '.txt',
    })
    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'],
      filters: [
        {
          name: 'Supported documents',
          extensions: ['txt', 'pdf'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    })
  })

  it('offers only All Files when the provider lists no formats', async () => {
    const showOpenDialog: DocumentOpenDialog = fakeDialog(['/docs/a.bin'])
    const handlers: DocumentHandlers = buildHandlers({
      service: fakeService({
        supported: false,
        formats: [],
        message: 'Document translation not supported by this provider',
      }),
      showOpenDialog,
    }).handlers

    await handlers['document:pick']()

    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'],
      filters: [
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    })
  })

  it('returns null when the dialog is cancelled', async () => {
    const handlers: DocumentHandlers = buildHandlers({
      service: fakeService(),
      showOpenDialog: fakeDialog([], true),
    }).handlers

    expect(await handlers['document:pick']()).toBeNull()
  })
})
