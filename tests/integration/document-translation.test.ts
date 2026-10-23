import {
  afterAll, beforeAll, beforeEach, describe, expect, it, vi,
} from 'vitest'
import {
  mkdtemp, readdir, readFile, realpath, rm, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultScenario,
  startEmulator,
  type HttpEmulator,
  type RecordedRequest,
} from '@tests/support/libre-emulator'

type IpcHandler = (event: unknown, payload?: unknown) => Promise<unknown>

const electronState = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  userDataDir: '',
  nextPick: '',
  revealed: [] as string[],
}))

vi.mock('electron', () => ({
  app: {
    getVersion: (): string => '0.0.0-test',
    getPath: (): string => electronState.userDataDir,
  },
  dialog: {
    showOpenDialog: async (): Promise<{
      canceled: boolean
      filePaths: string[]
    }> => ({
      canceled: false,
      filePaths: [electronState.nextPick],
    }),
  },
  shell: {
    showItemInFolder: (fullPath: string): void => {
      electronState.revealed.push(fullPath)
    },
  },
  ipcMain: {
    handle: (channel: string, handler: IpcHandler): void => {
      electronState.handlers.set(channel, handler)
    },
  },
  safeStorage: {
    isEncryptionAvailable: (): boolean => true,
    encryptString: (plain: string): Buffer => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: (encrypted: Buffer): string => encrypted.toString('utf8').slice(4),
  },
}))

vi.mock('@electron/services/history/store', () => ({
  createHistoryStore: (): Record<string, never> => ({}),
}))

const API_KEY = 'SENSITIVE-FIXTURE-8d2f41aa-73c0-4e15'

async function invoke(channel: string, payload?: unknown): Promise<unknown> {
  const handler: IpcHandler | undefined = electronState.handlers.get(channel)

  if (!handler) {
    throw new Error(`no IPC handler registered for ${channel}`)
  }

  return handler({}, payload)
}

function requestsTo(emulator: HttpEmulator, prefix: string): RecordedRequest[] {
  return emulator.requests.filter((request: RecordedRequest) => request.path.startsWith(prefix))
}

describe('document translation through the IPC handler layer', () => {
  let libre: HttpEmulator
  let attacker: HttpEmulator
  let docsDir: string

  beforeAll(async () => {
    libre = await startEmulator()
    attacker = await startEmulator()
    electronState.userDataDir = await mkdtemp(join(tmpdir(), 'ot-it-userdata-'))

    const { registerIpcHandlers } = await import('@electron/main/ipc-setup')
    registerIpcHandlers({
      isDev: false,
      quickTranslateController: () => null,
      appSettingsApplier: { apply: vi.fn() },
    })

    await invoke('settings:update', {
      providers: {
        libretranslate: {
          enabled: true,
          endpoint: libre.origin,
          apiKey: null,
          requestTimeoutMs: 5_000,
          allowSelfSignedTls: false,
        },
      },
    })
    await invoke('secrets:set', {
      providerId: 'libretranslate',
      secret: API_KEY,
    })
    await invoke('provider:switch', { providerId: 'libretranslate' })
  })

  afterAll(async () => {
    await libre.close()
    await attacker.close()
    await rm(electronState.userDataDir, {
      recursive: true,
      force: true,
    })
  })

  beforeEach(async () => {
    libre.scenario = defaultScenario()
    libre.requests.length = 0
    attacker.requests.length = 0
    docsDir = await realpath(await mkdtemp(join(tmpdir(), 'ot-it-docs-')))

    return async (): Promise<void> => {
      await rm(docsDir, {
        recursive: true,
        force: true,
      })
    }
  })

  async function pick(filePath: string): Promise<string> {
    electronState.nextPick = filePath
    await invoke('document:pick')

    return filePath
  }

  async function sourceFile(name: string, content: string): Promise<string> {
    const filePath: string = join(docsDir, name)
    await writeFile(filePath, content)

    return pick(filePath)
  }

  it('reports the deployment formats in document:status', async () => {
    expect(await invoke('document:status')).toEqual({
      supported: true,
      formats: ['.txt', '.odt'],
      message: 'Document translation available',
    })
  })

  it('uploads the file, downloads the result and saves it unmodified next to the source', async () => {
    const filePath: string = await sourceFile('notes.txt', 'Hello world')

    const result = await invoke('document:translate', {
      filePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })

    const outputPath: string = join(docsDir, 'notes.ru.translated.txt')
    const upload: RecordedRequest | undefined = requestsTo(libre, '/translate_file')[0]
    const download: RecordedRequest | undefined = requestsTo(libre, '/download_file/')[0]
    const file = upload?.form?.get('file') as (Blob & { name: string }) | undefined

    expect(result).toEqual({
      outputPath,
      provider: 'libretranslate',
    })
    expect(file?.name).toBe('notes.txt')
    expect(await file?.text()).toBe('Hello world')
    expect(upload?.form?.get('source')).toBe('auto')
    expect(upload?.form?.get('target')).toBe('ru')
    expect(upload?.form?.get('api_key')).toBe(API_KEY)
    expect(download?.path).toBe('/download_file/0b9e.notes.txt')
    expect(JSON.stringify(download?.headers)).not.toContain(API_KEY)
    const saved: Buffer = await readFile(outputPath)
    expect(Array.from(saved)).toEqual(Array.from(libre.scenario.translatedBytes))
  })

  it('translates a dropped file and reveals only the output main produced', async () => {
    const filePath: string = join(docsDir, 'dropped.txt')
    await writeFile(filePath, 'Dropped text')
    await invoke('document:drop', { filePath })

    const result = await invoke('document:translate', {
      filePath,
      sourceLanguage: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'ru',
    }) as { outputPath: string }
    await invoke('document:reveal', { outputPath: '/etc/passwd' })

    expect(requestsTo(libre, '/translate_file')[0]?.form?.get('source')).toBe('en')
    expect(result.outputPath).toBe(join(docsDir, 'dropped.ru.translated.txt'))
    expect(electronState.revealed.at(-1)).toBe(result.outputPath)
  })

  it('rejects a picked extension the deployment does not list, naming the supported formats', async () => {
    const filePath: string = join(docsDir, 'report.pdf')
    await writeFile(filePath, '%PDF-1.7')

    await expect(pick(filePath)).rejects.toThrow(
      /^\[unsupported_document_type\] .*unsupported file type "\.pdf" — Supported formats: \.txt, \.odt$/,
    )
    await expect(invoke('document:translate', {
      filePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toThrow(/not selected through the document picker$/)
    expect(requestsTo(libre, '/translate_file')).toHaveLength(0)
  })

  it.each([
    ['a directory', (dir: string): string => dir, /^\[unsupported_document_type\] .*not a regular file/],
    ['a network path', (): string => '\\\\attacker\\share\\notes.txt', /^\[unsupported_document_type\] .*network paths/],
    ['a missing file', (dir: string): string => join(dir, 'gone.txt'), /^\[internal_app_error\] .*could not be opened/],
  ])('refuses to register a dropped %s', async (_label: string, target: (dir: string) => string, error: RegExp) => {
    await expect(invoke('document:drop', { filePath: target(docsDir) })).rejects.toThrow(error)
  })

  it('refuses a translatedFileUrl on another origin without contacting it', async () => {
    libre.scenario.translatedFileUrl = (_origin: string, storedName: string): string =>
      `${attacker.origin}/download_file/${storedName}`
    const filePath: string = await sourceFile('notes.txt', 'Hello')

    await expect(invoke('document:translate', {
      filePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toThrow(/^\[invalid_provider_response\] /)
    expect(attacker.requests).toHaveLength(0)
    expect(await readdir(docsDir)).toEqual(['notes.txt'])
  })

  it('does not follow a download redirect to another host', async () => {
    libre.scenario.downloadRedirect = `${attacker.origin}/steal`
    const filePath: string = await sourceFile('notes.txt', 'Hello')

    await expect(invoke('document:translate', {
      filePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toThrow(/^\[endpoint_unreachable\] .*redirect \(HTTP 302\)/)
    expect(attacker.requests).toHaveLength(0)
  })

  it('maps "files translation disabled" to unsupported_document_type', async () => {
    libre.scenario.uploadStatus = 403
    libre.scenario.uploadError = 'Files translation are disabled on this server.'
    const filePath: string = await sourceFile('notes.txt', 'Hello')

    await expect(invoke('document:translate', {
      filePath,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toThrow(/^\[unsupported_document_type\] /)
  })

  it.each([
    ['a traversal target language', {
      filePath: '/tmp/notes.txt',
      sourceLanguage: { mode: 'auto' },
      targetLanguage: '../../ru',
    }],
    ['a missing payload', undefined],
  ])('rejects %s with a normalized error', async (_label: string, payload: unknown) => {
    await expect(invoke('document:translate', payload)).rejects.toThrow(
      /^\[internal_app_error\] AppError: document:translate: invalid request payload$/,
    )
  })

  it('refuses a file that was not picked through the dialog and never uploads it', async () => {
    await sourceFile('picked.txt', 'ok')
    const unpicked: string = join(docsDir, 'secrets.txt')
    await writeFile(unpicked, 'do not exfiltrate')

    await expect(invoke('document:translate', {
      filePath: unpicked,
      sourceLanguage: { mode: 'auto' },
      targetLanguage: 'ru',
    })).rejects.toThrow(/^\[internal_app_error\] .*not selected through the document picker$/)
    expect(requestsTo(libre, '/translate_file')).toHaveLength(0)
  })

  it('rejects a relative path at selection with a normalized error and no upload', async () => {
    await expect(pick('notes.txt')).rejects.toThrow(
      /^\[internal_app_error\] AppError: document: file path must be absolute$/,
    )
    expect(requestsTo(libre, '/translate_file')).toHaveLength(0)
  })
})
