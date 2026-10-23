import {
  constants, type BigIntStats,
} from 'node:fs'
import {
  lstat, open, realpath, type FileHandle, type FileReadResult,
} from 'node:fs/promises'
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
import { concatChunks } from '@electron/services/http/bounded-body'

export interface SourceDocument {
  path: string
  fileName: string
  extension: string
  sizeBytes: number
}

export interface LoadedSourceDocument {
  document: SourceDocument
  content: DocumentBytes
}

export type BoundedRead = {
  kind: 'complete'
  bytes: DocumentBytes
} | {
  kind: 'too-large'
}

export type FileIdentity = Pick<BigIntStats, 'dev' | 'ino'>

export type PathIdentity = FileIdentity & Pick<BigIntStats, 'isSymbolicLink'>

interface OpenedSourceDocument {
  document: SourceDocument
  handle: FileHandle
}

const UPLOAD_LIMIT_LABEL: string = `${MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024)} MiB`
const NETWORK_PATH_RE: RegExp = /^[\\/]{2}/
const READ_CHUNK_BYTES: number = 64 * 1024
// O_NOFOLLOW and O_NONBLOCK are undefined on Windows; O_NONBLOCK keeps a FIFO from blocking open().
const SOURCE_OPEN_FLAGS: number = constants.O_RDONLY
  | (constants.O_NOFOLLOW ?? 0)
  | (constants.O_NONBLOCK ?? 0)

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

function assertLocalAbsolutePath(filePath: string): void {
  if (NETWORK_PATH_RE.test(filePath)) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: network paths are not supported — Copy the file to a local folder.',
    )
  }

  if (!isAbsolute(filePath)) {
    throw new AppError(ErrorCategory.InternalAppError, 'document: file path must be absolute')
  }
}

export function assertSameOpenedFile(opened: FileIdentity, atPath: PathIdentity): void {
  const isSameFile: boolean = !atPath.isSymbolicLink() &&
    opened.dev === atPath.dev &&
    opened.ino === atPath.ino

  if (!isSameFile) {
    throw new AppError(
      ErrorCategory.InternalAppError,
      'document: file changed while it was being opened — Pick the file again.',
    )
  }
}

function assertRegularFile(stats: BigIntStats): void {
  if (!stats.isFile()) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: not a regular file — Pick a document file.',
    )
  }

  if (stats.size === 0n) {
    throw new AppError(
      ErrorCategory.UnsupportedDocumentType,
      'document: file is empty — Pick a non-empty document.',
    )
  }

  if (stats.size > BigInt(MAX_DOCUMENT_UPLOAD_BYTES)) {
    throw tooLarge()
  }
}

async function openSourceDocument(filePath: string): Promise<OpenedSourceDocument> {
  assertLocalAbsolutePath(filePath)

  let realPath: string
  let handle: FileHandle

  try {
    realPath = await realpath(filePath)
    handle = await open(realPath, SOURCE_OPEN_FLAGS)
  } catch (err: unknown) {
    throw unreadable(err)
  }

  try {
    const stats: BigIntStats = await handle.stat({ bigint: true })
    assertSameOpenedFile(stats, await lstat(realPath, { bigint: true }))
    assertRegularFile(stats)

    return {
      handle,
      document: {
        path: realPath,
        fileName: basename(realPath),
        extension: normalizeDocumentExtension(extname(realPath)) ?? '',
        sizeBytes: Number(stats.size),
      },
    }
  } catch (err: unknown) {
    await handle.close()

    throw err
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

export async function readAtMost(handle: FileHandle, maxBytes: number): Promise<BoundedRead> {
  const chunks: Uint8Array[] = []
  let total: number = 0

  while (total <= maxBytes) {
    const chunk: Buffer = Buffer.alloc(Math.min(READ_CHUNK_BYTES, maxBytes + 1 - total))
    const { bytesRead }: FileReadResult<Buffer> = await handle.read(
      chunk,
      0,
      chunk.byteLength,
      null,
    )

    if (bytesRead === 0) {
      return {
        kind: 'complete',
        bytes: concatChunks(chunks, total),
      }
    }

    chunks.push(chunk.subarray(0, bytesRead))
    total += bytesRead
  }

  return { kind: 'too-large' }
}

export async function inspectSourceDocument(
  filePath: string,
  formats: readonly string[],
): Promise<SourceDocument> {
  const opened: OpenedSourceDocument = await openSourceDocument(filePath)

  try {
    assertSupportedExtension(opened.document, formats)

    return opened.document
  } finally {
    await opened.handle.close()
  }
}

export async function loadSourceDocument(
  filePath: string,
  formats: readonly string[],
): Promise<LoadedSourceDocument> {
  const opened: OpenedSourceDocument = await openSourceDocument(filePath)

  try {
    assertSupportedExtension(opened.document, formats)

    const read: BoundedRead = await readAtMost(opened.handle, MAX_DOCUMENT_UPLOAD_BYTES)

    if (read.kind === 'too-large') {
      throw tooLarge()
    }

    return {
      document: opened.document,
      content: read.bytes,
    }
  } catch (err: unknown) {
    throw err instanceof AppError ? err : unreadable(err)
  } finally {
    await opened.handle.close()
  }
}
