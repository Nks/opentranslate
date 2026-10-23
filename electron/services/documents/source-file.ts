import {
  readFile, realpath, stat,
} from 'node:fs/promises'
import type { Stats } from 'node:fs'
import {
  basename, extname, isAbsolute,
} from 'node:path'
import {
  normalizeDocumentExtension,
} from '@shared/documents/formats'
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
} from '@shared/documents/limits'
import {
  AppError, ErrorCategory,
} from '@shared/errors'
import type {
  DocumentBytes,
} from '@shared/providers/contract'

export interface SourceDocument {
  path: string
  fileName: string
  extension: string
  sizeBytes: number
}

const UPLOAD_LIMIT_LABEL: string = `${MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024)} MiB`
const NETWORK_PATH_RE: RegExp = /^[\\/]{2}/

function assertLocalPath(filePath: string): void {
  if (NETWORK_PATH_RE.test(filePath)) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: network paths are not supported — Copy the file to a local folder.',
    )
  }
}

function unreadable(cause: unknown): AppError {
  return new AppError(
    ErrorCategory.InternalAppError,
    'document: file could not be opened — Pick the file again.',
    cause,
  )
}

function tooLarge(): AppError {
  return new AppError(
    ErrorCategory.UnsupportedDocumentType,
    `document: file is too large — Maximum size is ${UPLOAD_LIMIT_LABEL}.`,
  )
}

interface RealFile {
  path: string
  stats: Stats
}

async function statRealFile(filePath: string): Promise<RealFile> {
  try {
    const resolved: string = await realpath(filePath)

    return {
      path: resolved,
      stats: await stat(resolved),
    }
  } catch (err: unknown) {
    throw unreadable(err)
  }
}

export async function resolveSourceDocument(filePath: string): Promise<SourceDocument> {
  assertLocalPath(filePath)

  if (!isAbsolute(filePath)) {
    throw new AppError(ErrorCategory.InternalAppError, 'document: file path must be absolute')
  }

  const real: RealFile = await statRealFile(filePath)
  assertLocalPath(real.path)

  if (!real.stats.isFile()) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: not a regular file — Pick a document file.',
    )
  }

  if (real.stats.size === 0) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: file is empty — Pick a non-empty document.',
    )
  }

  if (real.stats.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw tooLarge()
  }

  return {
    path: real.path,
    fileName: basename(real.path),
    extension: normalizeDocumentExtension(extname(real.path)) ?? '',
    sizeBytes: real.stats.size,
  }
}

export function assertSupportedExtension(
  document: SourceDocument,
  formats: readonly string[],
): void {
  if (formats.includes(document.extension)) {
    return
  }

  const label: string = document.extension.length > 0 ? `"${document.extension}"` : 'without extension'

  throw new AppError(
    ErrorCategory.UnsupportedDocumentType,
    `document: unsupported file type ${label} — Supported formats: ${formats.join(', ')}`,
  )
}

export async function readSourceDocument(document: SourceDocument): Promise<DocumentBytes> {
  let content: Buffer<ArrayBuffer>

  try {
    content = await readFile(document.path)
  } catch (err: unknown) {
    throw unreadable(err)
  }

  if (content.byteLength > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw tooLarge()
  }

  return new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
}
