import {
  _electron as electron,
  type ElectronApplication,
} from '@playwright/test'
import {
  mkdtempSync, realpathSync, rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface PackagedSession {
  app: ElectronApplication
  userDataDir: string
}

export const packagedAppPath: string = process.env.OPENTRANSLATE_PACKAGED_APP ?? ''

const OS_KEYRING_ISOLATION_ARGS: readonly string[] = ['--use-mock-keychain', '--password-store=basic']

if (packagedAppPath === '' && process.env.CI) {
  throw new Error('OPENTRANSLATE_PACKAGED_APP must point at the packaged executable when CI is set')
}

export function removeTempDir(dir: string): void {
  rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}

export async function withPackagedApp(
  run: (session: PackagedSession) => Promise<void>,
): Promise<void> {
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
      removeTempDir(userDataDir)
    }
  }
}
