import {
  test, expect,
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync, readFileSync, realpathSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  startEmulator,
  type HttpEmulator,
} from '@tests/support/libre-emulator'
import {
  packagedAppPath,
  removeTempDir,
  withPackagedApp,
  type PackagedSession,
} from './support/packaged-session'

interface SettingsBridge {
  api: {
    settings: {
      update: (patch: Record<string, unknown>) => Promise<unknown>
    }
  }
}

interface RevealProbe {
  revealedPaths?: string[]
}

test.skip(packagedAppPath === '', 'Set OPENTRANSLATE_PACKAGED_APP to a packaged executable to run this smoke test')

function expectDownloadMark(filePath: string): void {
  if (process.platform === 'darwin') {
    const quarantine: string = execFileSync('xattr', ['-p', 'com.apple.quarantine', filePath]).toString()
    expect(quarantine).toMatch(/^0\d{3};/)

    return
  }

  if (process.platform === 'win32') {
    expect(readFileSync(`${filePath}:Zone.Identifier`, 'utf8')).toContain('ZoneId=3')
  }
}

async function stubOpenDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, pickedPath: string): void => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [pickedPath],
    })) as unknown as typeof dialog.showOpenDialog
  }, filePath)
}

async function stubShowItemInFolder(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }): void => {
    const probe: RevealProbe = globalThis as unknown as RevealProbe
    probe.revealedPaths = []
    shell.showItemInFolder = (fullPath: string): void => {
      probe.revealedPaths?.push(fullPath)
    }
  })
}

async function enableLibreTranslate(window: Page, endpoint: string): Promise<void> {
  await window.evaluate(async (libreEndpoint: string): Promise<void> => {
    const bridge: SettingsBridge = globalThis as unknown as SettingsBridge
    await bridge.api.settings.update({
      providers: {
        libretranslate: {
          enabled: true,
          endpoint: libreEndpoint,
          apiKey: null,
          requestTimeoutMs: 15_000,
          allowSelfSignedTls: false,
        },
      },
      app: {
        activeProvider: {
          providerId: 'libretranslate',
          sourceSelection: { mode: 'auto' },
          targetLanguage: 'ru',
        },
      },
    })
  }, endpoint)
}

async function openDocuments(window: Page): Promise<void> {
  await window.getByRole('link', { name: 'Documents' }).click()
  await expect(window.getByRole('heading', { name: 'Documents' })).toBeVisible()
}

test('packaged Documents page gates on provider capability and translates a picked file', async () => {
  const libre: HttpEmulator = await startEmulator()
  const docsDir: string = realpathSync.native(mkdtempSync(join(tmpdir(), 'opentranslate-docs-')))
  const sourcePath: string = join(docsDir, 'notes.txt')
  const unsupportedPath: string = join(docsDir, 'report.pdf')
  writeFileSync(sourcePath, 'Hello world')
  writeFileSync(unsupportedPath, '%PDF-1.7')

  try {
    await withPackagedApp(async ({ app }: PackagedSession): Promise<void> => {
      const window: Page = await app.firstWindow()
      await expect(window.getByRole('button', { name: 'Swap languages' })).toBeVisible({
        timeout: 30_000,
      })

      await openDocuments(window)
      await expect(window.getByRole('heading', {
        name: 'Configure a provider to start translating',
      })).toBeVisible()
      await expect(window.getByRole('button', { name: 'Choose file' })).toHaveCount(0)

      await enableLibreTranslate(window, libre.origin)
      await window.getByRole('link', { name: 'Back to translate' }).click()
      await expect(window.getByRole('heading', {
        name: 'Configure a provider to start translating',
      })).toBeHidden({ timeout: 30_000 })

      await openDocuments(window)
      const capability: Locator = window.getByRole('status', { name: 'Document capability' })
      await expect(capability).toContainText('Document translation available')
      await expect(window.getByRole('list', { name: 'Supported formats' })).toContainText('.txt')

      await stubOpenDialog(app, unsupportedPath)
      await window.getByRole('button', { name: 'Choose file' }).click()
      await expect(window.getByRole('alert')).toContainText('Supported formats: .txt, .odt')
      await expect(window.getByLabel('Selected document')).toHaveCount(0)
      await expect(window.getByRole('button', { name: 'Translate document' })).toBeDisabled()

      await stubOpenDialog(app, sourcePath)
      await window.getByRole('button', { name: 'Choose file' }).click()
      await expect(window.getByLabel('Selected document')).toHaveText('notes.txt')
      await expect(window.getByRole('alert')).toHaveCount(0)
      await window.getByRole('button', { name: 'Translate document' }).click()

      const outputPath: string = join(docsDir, 'notes.ru.translated.txt')
      await expect(window.getByLabel('Translated document')).toContainText(outputPath, {
        timeout: 30_000,
      })
      const saved: Buffer = readFileSync(outputPath)
      expect(Array.from(saved)).toEqual(Array.from(libre.scenario.translatedBytes))
      expectDownloadMark(outputPath)

      await stubShowItemInFolder(app)
      await window.getByRole('button', { name: 'Show in folder' }).click()
      await expect.poll(async (): Promise<string[]> => app.evaluate(
        (): string[] => (globalThis as unknown as RevealProbe).revealedPaths ?? [],
      )).toEqual([outputPath])
    })
  } finally {
    await libre.close()
    removeTempDir(docsDir)
  }
})
