// @vitest-environment happy-dom
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  createPinia, setActivePinia,
} from 'pinia'
import { useProvidersStore } from '@app/stores/providers'
import { ErrorCategory } from '@shared/errors'
import type {
  DocumentTranslateResponseShape,
} from '@electron/ipc/channels'
import {
  PRELOAD_WRAPPED_ERROR,
  SUPPORTED_STATUS,
  installToastStub,
  mockPick,
  mockReveal,
  mockDrop,
  mockStatus,
  selectionFor,
  mockTranslate,
} from './support/document-api'
import type * as DocumentApiSupport from './support/document-api'
import type * as UseDocumentTranslationModule from '@app/composables/useDocumentTranslation'

vi.mock('@app/composables/useApi', async () => {
  const { documentApi }: typeof DocumentApiSupport = await import('./support/document-api')

  return { useApi: () => documentApi }
})

const { useDocumentTranslation }: typeof UseDocumentTranslationModule = await import(
  '@app/composables/useDocumentTranslation'
)

type DocumentTranslation = ReturnType<typeof useDocumentTranslation>

async function readyWithFile(filePath: string): Promise<DocumentTranslation> {
  mockStatus.mockResolvedValue(SUPPORTED_STATUS)
  mockPick.mockResolvedValue(selectionFor(filePath))
  const documents: DocumentTranslation = useDocumentTranslation()
  await documents.checkSupport()
  await documents.pickFile()

  return documents
}

describe('useDocumentTranslation — translate and reveal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    installToastStub()
  })

  it('sends the selected source and target languages and exposes the output path', async () => {
    const store: ReturnType<typeof useProvidersStore> = useProvidersStore()
    store.sourceSelection = {
      mode: 'explicit',
      code: 'en',
    }
    store.targetLanguage = 'ru'
    mockTranslate.mockResolvedValue({
      outputPath: '/docs/notes.ru.translated.txt',
      provider: 'libretranslate',
    })
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')

    expect(documents.canTranslate.value).toBe(true)
    await documents.translate()

    expect(mockTranslate).toHaveBeenCalledWith({
      filePath: '/docs/notes.txt',
      sourceLanguage: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'ru',
    })
    expect(documents.outputPath.value).toBe('/docs/notes.ru.translated.txt')
    expect(documents.translating.value).toBe(false)
  })

  it('blocks translation while a request is in flight', async () => {
    useProvidersStore().targetLanguage = 'ru'
    let release: (value: DocumentTranslateResponseShape) => void = (): void => undefined
    mockTranslate.mockReturnValue(new Promise((resolve) => {
      release = resolve
    }))
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')

    const pending: Promise<void> = documents.translate()

    expect(documents.translating.value).toBe(true)
    expect(documents.canTranslate.value).toBe(false)
    release({
      outputPath: '/docs/notes.ru.translated.txt',
      provider: 'libretranslate',
    })
    await pending
    expect(documents.translating.value).toBe(false)
  })

  it('shows the normalized category and message instead of the raw IPC error', async () => {
    useProvidersStore().targetLanguage = 'ru'
    mockTranslate.mockRejectedValue(new Error(PRELOAD_WRAPPED_ERROR))
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')

    await documents.translate()

    expect(documents.error.value?.category).toBe(ErrorCategory.UnsupportedDocumentType)
    expect(documents.error.value?.short).toBe(
      'This file type is not supported for translation. Supported formats: .txt, .odt',
    )
    expect(documents.error.value?.short).not.toContain('Error invoking remote method')
    expect(documents.outputPath.value).toBeNull()
  })

  it('ignores a pick or drop while a translation is running', async () => {
    useProvidersStore().targetLanguage = 'ru'
    let release: (value: DocumentTranslateResponseShape) => void = (): void => undefined
    type Release = (value: DocumentTranslateResponseShape) => void
    mockTranslate.mockReturnValue(new Promise((resolve: Release) => {
      release = resolve
    }))
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')
    mockPick.mockClear()
    const pending: Promise<void> = documents.translate()

    await documents.pickFile()
    await documents.dropFiles([new File(['x'], 'other.txt')])

    expect(mockPick).not.toHaveBeenCalled()
    expect(mockDrop).not.toHaveBeenCalled()
    expect(documents.fileName.value).toBe('notes.txt')
    release({
      outputPath: '/docs/notes.ru.translated.txt',
      provider: 'libretranslate',
    })
    await pending
    expect(documents.outputPath.value).toBe('/docs/notes.ru.translated.txt')
  })

  it('requires a target language', async () => {
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')

    expect(documents.blockedReason.value).toBe('Select a target language.')
    await documents.translate()

    expect(mockTranslate).not.toHaveBeenCalled()
  })

  it('reveals the output through main and reports a failure', async () => {
    const documents: DocumentTranslation = useDocumentTranslation()
    mockReveal.mockResolvedValueOnce(undefined)
    await documents.reveal()
    expect(mockReveal).toHaveBeenCalledOnce()

    mockReveal.mockRejectedValueOnce(new Error('[document:reveal] [internal_app_error] AppError: x'))
    await documents.reveal()

    expect(documents.error.value).not.toBeNull()
  })

  it('clears the error on demand', async () => {
    useProvidersStore().targetLanguage = 'ru'
    mockTranslate.mockRejectedValue(new Error(PRELOAD_WRAPPED_ERROR))
    const documents: DocumentTranslation = await readyWithFile('/docs/notes.txt')
    await documents.translate()

    documents.clearError()

    expect(documents.error.value).toBeNull()
  })
})
