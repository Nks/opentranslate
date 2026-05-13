import {
  describe, expect, it, vi,
} from 'vitest'
import {
  handlePickFile,
  resolvePickFileErrorCode,
  MAX_CREDENTIALS_FILE_BYTES,
  PICK_FILE_ERROR_PERMISSION_DENIED,
  PICK_FILE_ERROR_NOT_A_FILE,
  PICK_FILE_ERROR_UNREADABLE,
  PICK_FILE_ERROR_TOO_LARGE,
  type PickFileDeps,
} from '@electron/main/pick-file'

const VALID_KEY_JSON = JSON.stringify({
  project_id: 'p',
  private_key: 'k',
  client_email: 'sa@example.com',
})

interface DialogCall {
  filters: ReadonlyArray<{
    name: string
    extensions: string[]
  }>
}

interface MakeDepsInput {
  dialogResult?: Awaited<ReturnType<PickFileDeps['showOpenDialog']>>
  statResult?: Awaited<ReturnType<PickFileDeps['stat']>>
  statError?: unknown
  readFileResult?: string
  readFileError?: unknown
}

function makeDeps(input: MakeDepsInput = {}): PickFileDeps & {
  dialogCalls: DialogCall[]
  statCalls: string[]
  readFileCalls: string[]
} {
  const dialogCalls: DialogCall[] = []
  const statCalls: string[] = []
  const readFileCalls: string[] = []
  const dialogResult: Awaited<ReturnType<PickFileDeps['showOpenDialog']>> =
    input.dialogResult ?? {
      canceled: false,
      filePaths: ['/Users/test/key.json'],
    }
  const statResult: Awaited<ReturnType<PickFileDeps['stat']>> =
    input.statResult ?? { size: 1024 }
  const readFileResult: string = input.readFileResult ?? VALID_KEY_JSON

  return {
    dialogCalls,
    statCalls,
    readFileCalls,
    showOpenDialog: vi.fn(async (call) => {
      dialogCalls.push({ filters: call.filters })

      return dialogResult
    }),
    stat: vi.fn(async (filePath: string) => {
      statCalls.push(filePath)

      if (input.statError !== undefined) {
        throw input.statError
      }

      return statResult
    }),
    readFile: vi.fn(async (filePath: string) => {
      readFileCalls.push(filePath)

      if (input.readFileError !== undefined) {
        throw input.readFileError
      }

      return readFileResult
    }),
  }
}

describe('resolvePickFileErrorCode', () => {
  it('maps ENOENT to permission-denied', () => {
    expect(resolvePickFileErrorCode({ code: 'ENOENT' })).toBe(PICK_FILE_ERROR_PERMISSION_DENIED)
  })

  it('maps EACCES to permission-denied', () => {
    expect(resolvePickFileErrorCode({ code: 'EACCES' })).toBe(PICK_FILE_ERROR_PERMISSION_DENIED)
  })

  it('maps EPERM to permission-denied', () => {
    expect(resolvePickFileErrorCode({ code: 'EPERM' })).toBe(PICK_FILE_ERROR_PERMISSION_DENIED)
  })

  it('maps EISDIR to not-a-file', () => {
    expect(resolvePickFileErrorCode({ code: 'EISDIR' })).toBe(PICK_FILE_ERROR_NOT_A_FILE)
  })

  it('returns unreadable for unknown error codes', () => {
    expect(resolvePickFileErrorCode({ code: 'EUNKNOWN' })).toBe(PICK_FILE_ERROR_UNREADABLE)
  })

  it('returns unreadable for errors without a code property', () => {
    expect(resolvePickFileErrorCode(new Error('boom'))).toBe(PICK_FILE_ERROR_UNREADABLE)
    expect(resolvePickFileErrorCode(null)).toBe(PICK_FILE_ERROR_UNREADABLE)
    expect(resolvePickFileErrorCode('not even an object')).toBe(PICK_FILE_ERROR_UNREADABLE)
  })
})

describe('handlePickFile — validated mode', () => {
  it('returns the path with valid validation when stat + read + JSON succeed', async () => {
    const deps = makeDeps()
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.filePath).toBe('/Users/test/key.json')
    expect(result.validation?.ok).toBe(true)
  })

  it('overrides renderer-supplied filters in validated mode (security: validation wins)', async () => {
    const deps = makeDeps()
    await handlePickFile(
      {
        validate: 'google-service-account',
        filters: [
          {
            name: 'Anything',
            extensions: ['exe', 'sh', 'js'],
          },
        ],
      },
      deps,
    )

    expect(deps.dialogCalls).toHaveLength(1)
    expect(deps.dialogCalls[0]?.filters).toEqual([
      {
        name: 'JSON',
        extensions: ['json'],
      },
    ])
  })

  it('rejects files larger than the 1MB cap with error code "too-large"', async () => {
    const deps = makeDeps({
      statResult: { size: MAX_CREDENTIALS_FILE_BYTES + 1 },
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.ok).toBe(false)
    expect(result.validation?.error).toBe(PICK_FILE_ERROR_TOO_LARGE)
    expect(deps.readFileCalls).toHaveLength(0)
  })

  it('accepts a file exactly at the size cap', async () => {
    const deps = makeDeps({
      statResult: { size: MAX_CREDENTIALS_FILE_BYTES },
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.ok).toBe(true)
    expect(deps.readFileCalls).toEqual(['/Users/test/key.json'])
  })

  it('calls stat before readFile so an oversized file never hits readFile', async () => {
    const deps = makeDeps({
      statResult: { size: MAX_CREDENTIALS_FILE_BYTES + 1024 },
    })
    await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(deps.statCalls).toEqual(['/Users/test/key.json'])
    expect(deps.readFileCalls).toEqual([])
  })

  it('returns a redacted code when stat fails with ENOENT (never echoes raw fs message)', async () => {
    const deps = makeDeps({
      statError: Object.assign(new Error('ENOENT: no such file at /etc/secrets'), {
        code: 'ENOENT',
      }),
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.ok).toBe(false)
    expect(result.validation?.error).toBe(PICK_FILE_ERROR_PERMISSION_DENIED)
    expect(JSON.stringify(result)).not.toContain('/etc/secrets')
    expect(JSON.stringify(result)).not.toContain('ENOENT')
  })

  it('returns "not-a-file" when stat reports EISDIR', async () => {
    const deps = makeDeps({
      statError: Object.assign(new Error('directory'), { code: 'EISDIR' }),
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.error).toBe(PICK_FILE_ERROR_NOT_A_FILE)
  })

  it('returns a redacted code when readFile fails with EACCES', async () => {
    const deps = makeDeps({
      readFileError: Object.assign(new Error('permission denied at /Users/secrets/key.json'), {
        code: 'EACCES',
      }),
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.ok).toBe(false)
    expect(result.validation?.error).toBe(PICK_FILE_ERROR_PERMISSION_DENIED)
    expect(JSON.stringify(result)).not.toContain('/Users/secrets')
  })

  it('returns "unreadable" for unknown read errors', async () => {
    const deps = makeDeps({
      readFileError: Object.assign(new Error('weird'), { code: 'EWEIRD' }),
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.error).toBe(PICK_FILE_ERROR_UNREADABLE)
  })

  it('returns the validator verdict for syntactically invalid JSON', async () => {
    const deps = makeDeps({ readFileResult: 'not valid json' })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.validation?.ok).toBe(false)
    expect(result.validation?.error).toMatch(/JSON/i)
  })

  it('returns null filePath when the dialog is canceled', async () => {
    const deps = makeDeps({
      dialogResult: {
        canceled: true,
        filePaths: [],
      },
    })
    const result = await handlePickFile(
      { validate: 'google-service-account' },
      deps,
    )

    expect(result.filePath).toBeNull()
    expect(result.validation).toBeUndefined()
    expect(deps.statCalls).toEqual([])
    expect(deps.readFileCalls).toEqual([])
  })
})

describe('handlePickFile — unvalidated mode', () => {
  it('passes renderer filters through unchanged', async () => {
    const deps = makeDeps()
    await handlePickFile(
      {
        filters: [
          {
            name: 'Text',
            extensions: ['txt'],
          },
        ],
      },
      deps,
    )

    expect(deps.dialogCalls[0]?.filters).toEqual([
      {
        name: 'Text',
        extensions: ['txt'],
      },
    ])
  })

  it('returns the picked path without reading or validating the file', async () => {
    const deps = makeDeps()
    const result = await handlePickFile({}, deps)

    expect(result.filePath).toBe('/Users/test/key.json')
    expect(result.validation).toBeUndefined()
    expect(deps.statCalls).toEqual([])
    expect(deps.readFileCalls).toEqual([])
  })
})
