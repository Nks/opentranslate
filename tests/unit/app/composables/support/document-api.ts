import { vi } from 'vitest'
import type {
  DocumentPickResponseShape,
  DocumentStatusResponseShape,
  DocumentTranslateRequestShape,
  DocumentTranslateResponseShape,
} from '@electron/ipc/channels'

export const mockStatus = vi.fn<() => Promise<DocumentStatusResponseShape>>()
export const mockPick = vi.fn<() => Promise<DocumentPickResponseShape | null>>()
export const mockDrop = vi.fn<(file: File) => Promise<DocumentPickResponseShape | null>>()
export const mockReveal = vi.fn<() => Promise<void>>()
export const mockTranslate = vi.fn<
  (input: DocumentTranslateRequestShape) => Promise<DocumentTranslateResponseShape | null>
>()
export const mockToastAdd = vi.fn<(options: Record<string, unknown>) => void>()

export const documentApi = {
  documents: {
    status: mockStatus,
    pick: mockPick,
    selectDroppedFile: mockDrop,
    translate: mockTranslate,
    reveal: mockReveal,
  },
}

export const PRELOAD_WRAPPED_ERROR: string = "[document:translate] Error invoking remote method 'document:translate': Error: [unsupported_document_type] AppError: document: unsupported file type \".pdf\" — Supported formats: .txt, .odt"

export const SUPPORTED_STATUS: DocumentStatusResponseShape = {
  supported: true,
  formats: ['.txt', '.odt'],
  message: 'Document translation available',
}

export function installToastStub(): void {
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: mockToastAdd })
}
