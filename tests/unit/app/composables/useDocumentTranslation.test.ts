// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { ErrorCategory } from '@shared/errors'

import {
  SUPPORTED_STATUS,
  installToastStub,
  mockDrop,
  mockPick,
  mockStatus,
  mockToastAdd,
  mockTranslate,
} from './support/document-api'

vi.mock('@app/composables/useApi', async () => {
  const { documentApi } = await import('./support/document-api')

  return { useApi: () => documentApi }
})

const { useDocumentTranslation } = await import('@app/composables/useDocumentTranslation')

type DocumentTranslation = ReturnType<typeof useDocumentTranslation>

async function readyWithFile(filePath: string): Promise<DocumentTranslation> {
  mockStatus.mockResolvedValue(SUPPORTED_STATUS)
  mockPick.mockResolvedValue({ filePath })
  const documents: DocumentTranslation = useDocumentTranslation()
  await documents.checkSupport()
  await documents.pickFile()

  return documents
}

describe('useDocumentTranslation — capability', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    installToastStub()
  })

  it('exposes support, formats and message from document:status', async () => {
    mockStatus.mockResolvedValue(SUPPORTED_STATUS)
    const documents: DocumentTranslation = useDocumentTranslation()

    await documents.checkSupport()

    expect(documents.supported.value).toBe(true)
    expect(documents.formats.value).toEqual(['.txt', '.odt'])
    expect(documents.statusMessage.value).toBe('Document translation available')
    expect(documents.checking.value).toBe(false)
  })

  it('disables documents and toasts when the status check fails', async () => {
    mockStatus.mockRejectedValue(new Error('[document:status] boom'))
    const documents: DocumentTranslation = useDocumentTranslation()

    await documents.checkSupport()

    expect(documents.supported.value).toBe(false)
    expect(documents.formats.value).toEqual([])
    expect(documents.statusMessage.value).toBe('Unable to check document support')
    expect(mockToastAdd).toHaveBeenCalledOnce()
  })

  it('clears the result and re-checks support after a provider change', async () => {
    useProvidersStore().targetLanguage = 'ru'
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')
    mockTranslate.mockResolvedValue({
      outputPath: '/docs/notes.ru.translated.txt',
      provider: 'libretranslate',
    })
    await documents.translate()
    mockStatus.mockResolvedValue({
      supported: false,
      message: 'Document translation not supported by this provider',
    })

    await documents.onProviderChanged()

    expect(documents.outputPath.value).toBeNull()
    expect(documents.supported.value).toBe(false)
    expect(documents.canTranslate.value).toBe(false)
  })
})

describe('useDocumentTranslation — file selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    installToastStub()
  })

  it('derives the file name for POSIX and Windows paths', async () => {
    const documents: DocumentTranslation = await readyWithFile('/Users/me/notes.txt')
    expect(documents.fileName.value).toBe('notes.txt')

    mockPick.mockResolvedValue({ filePath: 'C:\\Users\\me\\report.odt' })
    await documents.pickFile()
    expect(documents.fileName.value).toBe('report.odt')
  })

  it('keeps the current file when the dialog is cancelled', async () => {
    const documents: DocumentTranslation = await readyWithFile('/docs/a.txt')
    mockPick.mockResolvedValueOnce(null)

    await documents.pickFile()

    expect(documents.filePath.value).toBe('/docs/a.txt')
  })

  it('selects a single dropped file through the preload bridge', async () => {
    mockStatus.mockResolvedValue(SUPPORTED_STATUS)
    mockDrop.mockResolvedValue({ filePath: '/docs/dropped.txt' })
    const documents: DocumentTranslation = useDocumentTranslation()
    await documents.checkSupport()
    const file: File = new File(['x'], 'dropped.txt')

    await documents.dropFiles([file])

    expect(mockDrop).toHaveBeenCalledWith(file)
    expect(documents.fileName.value).toBe('dropped.txt')
  })

  it.each([
    ['no files', null],
    ['several files', [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]],
  ])('rejects a drop with %s', async (_label: string, files: File[] | null) => {
    mockStatus.mockResolvedValue(SUPPORTED_STATUS)
    const documents: DocumentTranslation = useDocumentTranslation()
    await documents.checkSupport()

    await documents.dropFiles(files)

    expect(mockDrop).not.toHaveBeenCalled()
    expect(documents.error.value?.short).toContain('one file')
  })

  it('explains a dropped item that has no file on disk', async () => {
    mockStatus.mockResolvedValue(SUPPORTED_STATUS)
    mockDrop.mockResolvedValue(null)
    const documents: DocumentTranslation = useDocumentTranslation()
    await documents.checkSupport()

    await documents.dropFiles([new File(['x'], 'clip.txt')])

    expect(documents.filePath.value).toBeNull()
    expect(documents.error.value?.short).toContain('from your computer')
  })

  it('ignores drops while documents are unsupported', async () => {
    mockStatus.mockResolvedValue({ supported: false })
    const documents: DocumentTranslation = useDocumentTranslation()
    await documents.checkSupport()

    await documents.dropFiles([new File(['x'], 'a.txt')])

    expect(mockDrop).not.toHaveBeenCalled()
    expect(documents.error.value?.category).toBe(ErrorCategory.UnsupportedDocumentType)
  })

  it('flags a picked file whose extension the provider does not list', async () => {
    useProvidersStore().targetLanguage = 'ru'
    const documents: DocumentTranslation = await readyWithFile('/docs/report.pdf')

    expect(documents.fileFormatSupported.value).toBe(false)
    expect(documents.blockedReason.value).toBe(
      'This provider does not accept .pdf files. Supported formats: .txt, .odt',
    )
    expect(documents.canTranslate.value).toBe(false)
  })
})
