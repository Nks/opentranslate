import { randomUUID } from 'node:crypto'
import {
  rename, rm, writeFile,
} from 'node:fs/promises'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

function errorCode(err: unknown): string {
  const code: unknown = err !== null && typeof err === 'object' && 'code' in err
    ? (err as { code: unknown }).code
    : undefined

  return typeof code === 'string' ? code : 'unknown'
}

export async function writeDocumentAtomically(
  outputPath: string,
  content: Uint8Array,
): Promise<void> {
  const partialPath: string = `${outputPath}.${randomUUID()}.partial`

  try {
    await writeFile(partialPath, content, {
      flag: 'wx',
    })
    await rename(partialPath, outputPath)
  } catch (err: unknown) {
    await rm(partialPath, {
      force: true,
    })

    throw new AppError(
      ErrorCategory.InternalAppError,
      `document: could not save the translated file (${errorCode(err)}) — Check that the folder is writable and has free space.`,
      err,
    )
  }
}
