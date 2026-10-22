import {
  _electron as electron, test, expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import {
  existsSync, mkdtempSync, realpathSync, rmSync,
} from 'node:fs'
import {
  tmpdir,
} from 'node:os'
import {
  join,
} from 'node:path'

interface HistoryEntryShape {
  id: string
  sourceText: string
}

interface HistoryBridge {
  api: {
    history: {
      add: (input: {
        sourceText: string
        translatedText: string
        sourceLanguageCode: string
        targetLanguageCode: string
        provider: string
      }) => Promise<HistoryEntryShape | null>
      list: (input: { limit: number }) => Promise<HistoryEntryShape[]>
    }
  }
}

interface HistoryRoundTrip {
  addedId: string | null
  listedSourceTexts: string[]
}

interface PackagedRuntime {
  isPackaged: boolean
  userData: string
}

interface PackagedSession {
  app: ElectronApplication
  userDataDir: string
}

const packagedAppPath: string = process.env.OPENTRANSLATE_PACKAGED_APP ?? ''
const OS_KEYRING_ISOLATION_ARGS: readonly string[] = ['--use-mock-keychain', '--password-store=basic']

if (packagedAppPath === '' && process.env.CI) {
  throw new Error('OPENTRANSLATE_PACKAGED_APP must point at the packaged executable when CI is set')
}

test.skip(packagedAppPath === '', 'Set OPENTRANSLATE_PACKAGED_APP to a packaged executable to run this smoke test')

function removeUserDataDir(userDataDir: string): void {
  rmSync(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}

async function withPackagedApp(run: (session: PackagedSession) => Promise<void>): Promise<void> {
  const userDataDir: string = realpathSync(mkdtempSync(join(tmpdir(), 'opentranslate-packaged-')))
  let app: ElectronApplication | null = null

  try {
    app = await electron.launch({
      executablePath: packagedAppPath,
      args: [`--user-data-dir=${userDataDir}`, ...OS_KEYRING_ISOLATION_ARGS],
      timeout: 60_000,
    })
    await run({
      app,
      userDataDir,
    })
  } finally {
    try {
      await app?.close()
    } finally {
      removeUserDataDir(userDataDir)
    }
  }
}

test('packaged app runs isolated, renders the SPA and round-trips history via better-sqlite3', async () => {
  await withPackagedApp(async ({
    app, userDataDir,
  }: PackagedSession): Promise<void> => {
    const runtime: PackagedRuntime = await app.evaluate(({
      app: electronApp,
    }): PackagedRuntime => ({
      isPackaged: electronApp.isPackaged,
      userData: electronApp.getPath('userData'),
    }))

    expect(runtime.isPackaged).toBe(true)
    expect(realpathSync(runtime.userData)).toBe(userDataDir)

    const window: Page = await app.firstWindow()

    await expect(window).toHaveURL(/^app:\/\/app\//)
    await expect(window.getByRole('button', {
      name: 'Swap languages',
    })).toBeVisible({
      timeout: 30_000,
    })
    await expect(window.getByRole('heading', {
      name: 'Configure a provider to start translating',
    })).toBeVisible()

    const marker: string = `packaged-smoke-${Date.now()}`
    const roundTrip: HistoryRoundTrip = await window.evaluate(async (
      sourceText: string,
    ): Promise<HistoryRoundTrip> => {
      const bridge: HistoryBridge = globalThis as unknown as HistoryBridge
      const added: HistoryEntryShape | null = await bridge.api.history.add({
        sourceText,
        translatedText: 'smoke',
        sourceLanguageCode: 'en',
        targetLanguageCode: 'de',
        provider: 'libretranslate',
      })
      const listed: HistoryEntryShape[] = await bridge.api.history.list({
        limit: 10,
      })

      return {
        addedId: added?.id ?? null,
        listedSourceTexts: listed.map((entry: HistoryEntryShape): string => entry.sourceText),
      }
    }, marker)

    expect(roundTrip.addedId).not.toBeNull()
    expect(roundTrip.listedSourceTexts).toContain(marker)
    expect(existsSync(join(userDataDir, 'history.db'))).toBe(true)
  })
})

test('packaged app loads the uiohook-napi native module from app.asar.unpacked', async () => {
  await withPackagedApp(async ({
    app,
  }: PackagedSession): Promise<void> => {
    const hookStartType: string = await app.evaluate((): string => {
      const loaded: { uIOhook?: { start?: unknown } } | undefined =
        process.mainModule?.require('uiohook-napi') as { uIOhook?: { start?: unknown } } | undefined

      return typeof loaded?.uIOhook?.start
    })

    expect(hookStartType).toBe('function')
  })
})
