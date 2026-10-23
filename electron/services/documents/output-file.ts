import { randomUUID } from 'node:crypto'
import {
  rename, rm, writeFile,
} from 'node:fs/promises'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

/** Windows Mark-of-the-Web: the Internet zone, as browsers write for downloads. */
export const ZONE_IDENTIFIER_CONTENT: string = '[ZoneTransfer]\r\nZoneId=3\r\n'

function errorCode(err: unknown): string {
  const code: unknown = err !== null && typeof err === 'object' && 'code' in err
    ? (err as { code: unknown }).code
    : undefined

  return typeof code === 'string' ? code : 'unknown'
}

async function markAsDownloaded(filePath: string, platform: NodeJS.Platform): Promise<void> {
  if (platform !== 'win32') {
    return
  }

  try {
    await writeFile(`${filePath}:Zone.Identifier`, ZONE_IDENTIFIER_CONTENT)
  } catch (err: unknown) {
    // FAT32/exFAT volumes have no alternate data streams; browsers skip the mark there too.
    // eslint-disable-next-line no-console
    console.error('[documents] could not write the Zone.Identifier mark', errorCode(err))
  }
}

export async function writeDocumentAtomically(
  outputPath: string,
  content: Uint8Array,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const partialPath: string = `${outputPath}.${randomUUID()}.partial`

  try {
    await writeFile(partialPath, content, {
      flag: 'wx',
    })
    await markAsDownloaded(partialPath, platform)
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
