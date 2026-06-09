import {
  _electron as electron, test, expect,
} from '@playwright/test'
import {
  fileURLToPath,
} from 'node:url'
import {
  dirname, resolve,
} from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(testDir, '..', '..')
const mainEntry = resolve(rootDir, 'dist-electron/main.cjs')

test('Electron shell launches, creates a secure window, exposes the preload API', async () => {
  const app = await electron.launch({
    args: [mainEntry],
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_SMOKE_TEST: '1',
      NODE_ENV: 'test',
    },
    timeout: 30_000,
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Main-process view: exactly one window open.
  const windowCount = await app.evaluate(({
    BrowserWindow,
  }) => {
    return BrowserWindow.getAllWindows().length
  })
  expect(windowCount).toBe(1)

  // Renderer-side security invariants. contextIsolation + nodeIntegration
  // verified indirectly via their observable effects in the renderer:
  //   * `require` must be undefined (nodeIntegration = false)
  //   * `process` must be undefined (node globals not leaked)
  //   * `window.api` must exist (contextBridge requires contextIsolation = true)
  const security = await window.evaluate(() => ({
    hasRequire: typeof (globalThis as unknown as {
      require?: unknown
    }).require !== 'undefined',
    hasProcess: typeof (globalThis as unknown as {
      process?: unknown
    }).process !== 'undefined',
    hasApi: typeof (globalThis as unknown as {
      api?: unknown
    }).api === 'object',
  }))
  expect(security.hasRequire).toBe(false)
  expect(security.hasProcess).toBe(false)
  expect(security.hasApi).toBe(true)

  // Preload surface round-trips the baseline IPC channels.
  const version = await window.evaluate(async () => {
    const host = globalThis as unknown as {
      api: {
        getVersion: () => Promise<string>
      }
    }

    return host.api.getVersion()
  })
  expect(typeof version).toBe('string')
  expect(version.length).toBeGreaterThan(0)

  const platform = await window.evaluate(async () => {
    const host = globalThis as unknown as {
      api: {
        getPlatform: () => Promise<string>
      }
    }

    return host.api.getPlatform()
  })
  expect(['darwin', 'win32', 'linux']).toContain(platform)

  await app.close()
})
