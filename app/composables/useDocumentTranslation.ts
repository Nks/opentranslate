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
  const api: ReturnType<typeof useApi> = useApi()
  const handleError: (err: unknown) => void = useHandleError()
  const providersStore: ReturnType<typeof useProvidersStore> = useProvidersStore()

  const status = ref<DocumentStatusResponseShape | null>(null)
  const statusError = ref<FormattedError | null>(null)
  const checking = ref<boolean>(false)
  const selection = ref<DocumentPickResponseShape | null>(null)
  const outputPath = ref<string | null>(null)
  const translating = ref<boolean>(false)
  const error = ref<FormattedError | null>(null)

  const supported = computed<boolean>(() => status.value?.supported === true)
  const formats = computed<string[]>(() => status.value?.formats ?? [])
  const statusMessage = computed<string>(() => {
    if (checking.value) {
      return CHECKING_MESSAGE
    }

    const isKnownStatusError: boolean = statusError.value !== null &&
      statusError.value.category !== 'unknown'

    if (isKnownStatusError) {
      return statusError.value?.short ?? STATUS_FAILED_MESSAGE
    }

    if (status.value === null) {
      return STATUS_FAILED_MESSAGE
    }

    return status.value.message ?? (status.value.supported
      ? 'Document translation available'
      : 'Document translation not supported by the active provider')
  })
  const filePath = computed<string | null>(() => selection.value?.filePath ?? null)
  const fileName = computed<string>(() => selection.value?.fileName ?? '')
  const fileExtension = computed<string>(() => selection.value?.extension ?? '')
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
    selection.value = picked
    outputPath.value = null
    clearError()
  }

  async function checkSupport(): Promise<void> {
    checking.value = true
    statusError.value = null

    try {
      status.value = await api.documents.status()
    } catch (err: unknown) {
      status.value = null
      statusError.value = formatErrorMessage(err)
      handleError(err)
    } finally {
      checking.value = false
    }
  }

  async function onProviderChanged(): Promise<void> {
    selection.value = null
    outputPath.value = null
    clearError()
    await checkSupport()
  }

  async function pickFile(): Promise<void> {
    if (translating.value) {
      return
    }

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
    if (translating.value) {
      return
    }

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
