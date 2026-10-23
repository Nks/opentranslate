import {
  afterAll, beforeAll, beforeEach, vi,
} from 'vitest'
import {
  mkdtemp, realpath, rm, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultScenario,
  startEmulator,
  type HttpEmulator,
  type RecordedRequest,
} from '@tests/support/libre-emulator'
import type * as IpcSetupModule from '@electron/main/ipc-setup'

export type IpcHandler = (event: unknown, payload?: unknown) => Promise<unknown>

export interface ElectronIpcState {
  handlers: Map<string, IpcHandler>
  userDataDir: string
  nextPick: string
  revealed: string[]
}

export interface DialogResult {
  canceled: boolean
  filePaths: string[]
}

export const electronState: ElectronIpcState = {
  handlers: new Map<string, IpcHandler>(),
  userDataDir: '',
  nextPick: '',
  revealed: [],
}

export const electronModule = {
  app: {
    getVersion: (): string => '0.0.0-test',
    getPath: (): string => electronState.userDataDir,
  },
  dialog: {
    showOpenDialog: async (): Promise<DialogResult> => ({
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
}

export const HARNESS_API_KEY: string = 'SENSITIVE-FIXTURE-8d2f41aa-73c0-4e15'

export async function invoke(channel: string, payload?: unknown): Promise<unknown> {
  const handler: IpcHandler | undefined = electronState.handlers.get(channel)

  if (!handler) {
    throw new Error(`no IPC handler registered for ${channel}`)
  }

  return handler({}, payload)
}

export function requestsTo(emulator: HttpEmulator, prefix: string): RecordedRequest[] {
  return emulator.requests.filter(
    (request: RecordedRequest): boolean => request.path.startsWith(prefix),
  )
}

export interface DocumentIpcHarness {
  readonly libre: HttpEmulator
  readonly attacker: HttpEmulator
  readonly docsDir: string
  pick: (filePath: string) => Promise<string>
  sourceFile: (name: string, content: string) => Promise<string>
}

async function bootIpc(endpoint: string): Promise<void> {
  const { registerIpcHandlers }: typeof IpcSetupModule = await import('@electron/main/ipc-setup')
  registerIpcHandlers({
    isDev: false,
    quickTranslateController: () => null,
    appSettingsApplier: { apply: vi.fn() },
  })

  await invoke('settings:update', {
    providers: {
      libretranslate: {
        enabled: true,
        endpoint,
        apiKey: null,
        requestTimeoutMs: 5_000,
        allowSelfSignedTls: false,
      },
    },
  })
  await invoke('secrets:set', {
    providerId: 'libretranslate',
    secret: HARNESS_API_KEY,
  })
  await invoke('provider:switch', { providerId: 'libretranslate' })
}

export function useDocumentIpcHarness(): DocumentIpcHarness {
  let libre: HttpEmulator | null = null
  let attacker: HttpEmulator | null = null
  let docsDir: string = ''

  function started<TValue>(value: TValue | null, name: string): TValue {
    if (value === null) {
      throw new Error(`${name} is not started`)
    }

    return value
  }

  beforeAll(async () => {
    libre = await startEmulator()
    attacker = await startEmulator()
    electronState.userDataDir = await mkdtemp(join(tmpdir(), 'ot-it-userdata-'))
    await bootIpc(libre.origin)
  })

  afterAll(async () => {
    await libre?.close()
    await attacker?.close()
    await rm(electronState.userDataDir, {
      recursive: true,
      force: true,
    })
  })

  beforeEach(async () => {
    const libreEmulator: HttpEmulator = started(libre, 'libre')
    libreEmulator.scenario = defaultScenario()
    libreEmulator.requests.length = 0
    started(attacker, 'attacker').requests.length = 0
    docsDir = await realpath(await mkdtemp(join(tmpdir(), 'ot-it-docs-')))
    const ownDir: string = docsDir

    return async (): Promise<void> => {
      await rm(ownDir, {
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

  return {
    get libre(): HttpEmulator {
      return started(libre, 'libre')
    },
    get attacker(): HttpEmulator {
      return started(attacker, 'attacker')
    },
    get docsDir(): string {
      return docsDir
    },
    pick,
    sourceFile,
  }
}
