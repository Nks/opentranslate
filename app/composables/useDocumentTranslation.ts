import {
  computed, ref,
} from 'vue'
import { useApi } from '@app/composables/useApi'
import { useHandleError } from '@app/composables/useHandleError'
import { useProvidersStore } from '@app/stores/providers'
import {
  formatErrorMessage, type FormattedError,
} from '@shared/errors/format'
import { ErrorCategory } from '@shared/errors'
import {
  documentBaseName, documentExtension,
} from '@shared/documents/file-name'
import type {
  DocumentPickResponseShape,
  DocumentStatusResponseShape,
  DocumentTranslateResponseShape,
} from '@electron/ipc/channels'

const CHECKING_MESSAGE: string = 'Checking provider capability...'
const STATUS_FAILED_MESSAGE: string = 'Unable to check document support'

function selectionError(message: string): FormattedError {
  return {
    short: message,
    detail: message,
    category: ErrorCategory.UnsupportedDocumentType,
  }
}

export function useDocumentTranslation() {
  const api = useApi()
  const handleError = useHandleError()
  const providersStore = useProvidersStore()

  const status = ref<DocumentStatusResponseShape | null>(null)
  const checking = ref<boolean>(false)
  const filePath = ref<string | null>(null)
  const outputPath = ref<string | null>(null)
  const translating = ref<boolean>(false)
  const error = ref<FormattedError | null>(null)

  const supported = computed<boolean>(() => status.value?.supported === true)
  const formats = computed<string[]>(() => status.value?.formats ?? [])
  const statusMessage = computed<string>(() => {
    if (checking.value) {
      return CHECKING_MESSAGE
    }

    if (status.value === null) {
      return STATUS_FAILED_MESSAGE
    }

    return status.value.message ?? (status.value.supported
      ? 'Document translation available'
      : 'Document translation not supported by the active provider')
  })
  const fileName = computed<string>(() => (filePath.value ? documentBaseName(filePath.value) : ''))
  const fileExtension = computed<string>(() => documentExtension(fileName.value))
  const fileFormatSupported = computed<boolean>(() => formats.value.includes(fileExtension.value))

  const blockedReason = computed<string | null>(() => {
    if (!supported.value) {
      return statusMessage.value
    }

    if (filePath.value === null) {
      return 'Choose or drop a document first.'
    }

    if (!fileFormatSupported.value) {
      const label: string = fileExtension.value.length > 0 ? `${fileExtension.value} files` : 'files without an extension'

      return `This provider does not accept ${label}. Supported formats: ${formats.value.join(', ')}`
    }

    if (providersStore.targetLanguage === null) {
      return 'Select a target language.'
    }

    return null
  })

  const canTranslate = computed<boolean>(() => blockedReason.value === null && !translating.value)

  function showError(err: unknown): void {
    error.value = formatErrorMessage(err)
  }

  function clearError(): void {
    error.value = null
  }

  function selectFile(picked: DocumentPickResponseShape): void {
    filePath.value = picked.filePath
    outputPath.value = null
    clearError()
  }

  async function checkSupport(): Promise<void> {
    checking.value = true

    try {
      status.value = await api.documents.status()
    } catch (err: unknown) {
      status.value = null
      handleError(err)
    } finally {
      checking.value = false
    }
  }

  async function onProviderChanged(): Promise<void> {
    outputPath.value = null
    clearError()
    await checkSupport()
  }

  async function pickFile(): Promise<void> {
    try {
      const picked: DocumentPickResponseShape | null = await api.documents.pick()

      if (picked) {
        selectFile(picked)
      }
    } catch (err: unknown) {
      showError(err)
    }
  }

  async function dropFiles(files: File[] | null): Promise<void> {
    if (!supported.value) {
      error.value = selectionError(statusMessage.value)

      return
    }

    const file: File | undefined = files?.[0]
    const isSingleFile: boolean = file !== undefined && files?.length === 1

    if (!isSingleFile || file === undefined) {
      error.value = selectionError('Drop exactly one file.')

      return
    }

    try {
      const picked: DocumentPickResponseShape | null = await api.documents.selectDroppedFile(file)

      if (picked) {
        selectFile(picked)

        return
      }

      error.value = selectionError('The dropped item is not a file. Drop a file from your computer.')
    } catch (err: unknown) {
      showError(err)
    }
  }

  async function translate(): Promise<void> {
    const targetLanguage: string | null = providersStore.targetLanguage

    if (!canTranslate.value || filePath.value === null || targetLanguage === null) {
      return
    }

    translating.value = true
    clearError()
    outputPath.value = null

    try {
      const result: DocumentTranslateResponseShape | null = await api.documents.translate({
        filePath: filePath.value,
        sourceLanguage: providersStore.sourceSelection,
        targetLanguage,
      })

      if (result) {
        outputPath.value = result.outputPath
      }
    } catch (err: unknown) {
      showError(err)
    } finally {
      translating.value = false
    }
  }

  async function reveal(): Promise<void> {
    try {
      await api.documents.reveal()
    } catch (err: unknown) {
      showError(err)
    }
  }

  return {
    checking,
    supported,
    formats,
    statusMessage,
    filePath,
    fileName,
    fileFormatSupported,
    outputPath,
    translating,
    error,
    blockedReason,
    canTranslate,
    checkSupport,
    onProviderChanged,
    pickFile,
    dropFiles,
    translate,
    reveal,
    clearError,
  }
}
