import type {
  SettingsPickFileFilter,
  SettingsPickFileRequestShape,
  SettingsPickFileResponseShape,
} from '@electron/ipc/channels'
import {
  validateGoogleServiceAccountJson,
} from '@electron/services/settings/credentials-validator'

/** Hard upper bound on credential file size (bytes). */
export const MAX_CREDENTIALS_FILE_BYTES = 1_000_000

export const JSON_FILE_FILTERS: readonly SettingsPickFileFilter[] = [
  {
    name: 'JSON',
    extensions: ['json'],
  },
]

/**
 * Fixed error codes returned to the renderer instead of raw `fs` /
 * filesystem error strings. Never echo the failing path, errno, or the
 * underlying message: the renderer treats these as opaque tokens and the
 * Settings UI maps them to user-friendly copy.
 */
export const PICK_FILE_ERROR_PERMISSION_DENIED = 'permission-denied'
export const PICK_FILE_ERROR_NOT_A_FILE = 'not-a-file'
export const PICK_FILE_ERROR_UNREADABLE = 'unreadable'
export const PICK_FILE_ERROR_TOO_LARGE = 'too-large'

export interface ShowOpenDialogInput {
  properties: ['openFile']
  filters: Array<{
    name: string
    extensions: string[]
  }>
}

export interface ShowOpenDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface StatLike {
  size: number
}

export interface PickFileDeps {
  showOpenDialog: (input: ShowOpenDialogInput) => Promise<ShowOpenDialogResult>
  stat: (filePath: string) => Promise<StatLike>
  readFile: (filePath: string, encoding: 'utf8') => Promise<string>
}

export function resolvePickFileErrorCode(err: unknown): string {
  if (err === null || typeof err !== 'object' || !('code' in err)) {
    return PICK_FILE_ERROR_UNREADABLE
  }

  const code: unknown = (err as { code: unknown }).code

  if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM') {
    return PICK_FILE_ERROR_PERMISSION_DENIED
  }

  if (code === 'EISDIR') {
    return PICK_FILE_ERROR_NOT_A_FILE
  }

  return PICK_FILE_ERROR_UNREADABLE
}

/**
 * Main-process handler for the `settings:pick-file` IPC channel.
 *
 * - Validation profile (`google-service-account`) wins over any
 *   renderer-supplied `filters`: the picker is always restricted to
 *   `.json` in that mode.
 * - Reads happen only after `stat()` confirms the file size is below
 *   `MAX_CREDENTIALS_FILE_BYTES` (1MB). A 1GB "JSON" cannot reach
 *   `readFile` and cannot OOM-crash main.
 * - Error responses use fixed string codes; the raw `fs` error message
 *   (which may leak the absolute path / errno / "no such file at
 *   `/Users/nks/.config/...`") never crosses the IPC boundary.
 */
export async function handlePickFile(
  input: SettingsPickFileRequestShape,
  deps: PickFileDeps,
): Promise<SettingsPickFileResponseShape> {
  const isValidatedPick: boolean = input.validate === 'google-service-account'
  // In validated mode, validation always wins — ignore renderer-supplied
  // filters so a tampered request cannot bypass the JSON gate.
  const filters: readonly SettingsPickFileFilter[] = isValidatedPick
    ? JSON_FILE_FILTERS
    : (input.filters ?? [])
  const result = await deps.showOpenDialog({
    properties: ['openFile'],
    filters: filters.map((entry) => ({
      name: entry.name,
      extensions: [...entry.extensions],
    })),
  })

  if (result.canceled || result.filePaths.length === 0) {
    return {
      filePath: null,
    }
  }

  const filePath: string = result.filePaths[0]!

  if (!isValidatedPick) {
    return {
      filePath,
    }
  }

  try {
    const stats = await deps.stat(filePath)

    if (stats.size > MAX_CREDENTIALS_FILE_BYTES) {
      return {
        filePath,
        validation: {
          ok: false,
          error: PICK_FILE_ERROR_TOO_LARGE,
        },
      }
    }
  } catch (err: unknown) {
    return {
      filePath,
      validation: {
        ok: false,
        error: resolvePickFileErrorCode(err),
      },
    }
  }

  let rawContents: string

  try {
    rawContents = await deps.readFile(filePath, 'utf8')
  } catch (err: unknown) {
    return {
      filePath,
      validation: {
        ok: false,
        error: resolvePickFileErrorCode(err),
      },
    }
  }

  return {
    filePath,
    validation: validateGoogleServiceAccountJson(rawContents),
  }
}
