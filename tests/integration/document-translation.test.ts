import {
  describe, expect, it, vi,
} from 'vitest'
import {
  readdir, readFile, writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import {
  HARNESS_API_KEY,
  electronState,
  invoke,
  requestsTo,
  useDocumentIpcHarness,
  type DocumentIpcHarness,
} from '@tests/support/document-ipc-harness'
import type { RecordedRequest } from '@tests/support/libre-emulator'

vi.mock('electron', async () => (await import('@tests/support/document-ipc-harness')).electronModule)

vi.mock('@electron/services/history/store', () => ({
  createHistoryStore: (): Record<string, never> => ({}),
}))

interface TranslateResult {
  outputPath: string
  provider: string
}

type UploadedFile = Blob & { name: string }

const harness: DocumentIpcHarness = useDocumentIpcHarness()

function translate(filePath: string): Promise<unknown> {
  return invoke('document:translate', {
    filePath,
    sourceLanguage: { mode: 'auto' },
    targetLanguage: 'ru',
  })
}

describe('document translation through the IPC handler layer', () => {
  it('reports the deployment formats in document:status', async () => {
    expect(await invoke('document:status')).toEqual({
      supported: true,
      formats: ['.txt', '.odt'],
      message: 'Document translation available',
    })
  })

  it('uploads the file, downloads the result and saves it unmodified next to the source', async () => {
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello world')

    const result: unknown = await translate(filePath)

    const outputPath: string = join(harness.docsDir, 'notes.ru.translated.txt')
    const upload: RecordedRequest | undefined = requestsTo(harness.libre, '/translate_file')[0]
    const download: RecordedRequest | undefined = requestsTo(harness.libre, '/download_file/')[0]
    const file: UploadedFile | undefined = upload?.form?.get('file') as UploadedFile | undefined
    const saved: Buffer = await readFile(outputPath)

    expect(result).toEqual({
      outputPath,
      provider: 'libretranslate',
    })
    expect(file?.name).toBe('notes.txt')
    expect(await file?.text()).toBe('Hello world')
    expect(upload?.form?.get('source')).toBe('auto')
    expect(upload?.form?.get('target')).toBe('ru')
    expect(upload?.form?.get('api_key')).toBe(HARNESS_API_KEY)
    expect(download?.path).toBe('/download_file/0b9e.notes.txt')
    expect(JSON.stringify(download?.headers)).not.toContain(HARNESS_API_KEY)
    expect(Array.from(saved)).toEqual(Array.from(harness.libre.scenario.translatedBytes))
  })

  it('translates a dropped file and reveals only the output main produced', async () => {
    const filePath: string = join(harness.docsDir, 'dropped.txt')
    await writeFile(filePath, 'Dropped text')
    await invoke('document:drop', { filePath })

    const result: TranslateResult = await invoke('document:translate', {
      filePath,
      sourceLanguage: {
        mode: 'explicit',
        code: 'en',
      },
      targetLanguage: 'ru',
    }) as TranslateResult
    await invoke('document:reveal', { outputPath: '/etc/passwd' })

    expect(requestsTo(harness.libre, '/translate_file')[0]?.form?.get('source')).toBe('en')
    expect(result.outputPath).toBe(join(harness.docsDir, 'dropped.ru.translated.txt'))
    expect(electronState.revealed.at(-1)).toBe(result.outputPath)
  })

  it('refuses a translatedFileUrl on another origin without contacting it', async () => {
    harness.libre.scenario.translatedFileUrl = (_origin: string, storedName: string): string =>
      `${harness.attacker.origin}/download_file/${storedName}`
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello')

    await expect(translate(filePath)).rejects.toThrow(/^\[invalid_provider_response\] /)
    expect(harness.attacker.requests).toHaveLength(0)
    expect(await readdir(harness.docsDir)).toEqual(['notes.txt'])
  })

  it('does not follow a download redirect to another host', async () => {
    harness.libre.scenario.downloadRedirect = `${harness.attacker.origin}/steal`
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello')

    await expect(translate(filePath)).rejects.toThrow(/^\[endpoint_unreachable\] .*redirect \(HTTP 302\)/)
    expect(harness.attacker.requests).toHaveLength(0)
  })

  it('maps "files translation disabled" to unsupported_document_type', async () => {
    harness.libre.scenario.uploadStatus = 403
    harness.libre.scenario.uploadError = 'Files translation are disabled on this server.'
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello')

    await expect(translate(filePath)).rejects.toThrow(/^\[unsupported_document_type\] /)
  })

  it('keeps an oversized provider error out of the message', async () => {
    harness.libre.scenario.uploadStatus = 500
    harness.libre.scenario.uploadError = 'x'.repeat(200_000)
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello')

    const message: string = await translate(filePath).then(
      (): string => '',
      (err: unknown): string => (err as Error).message,
    )

    expect(message).toMatch(/^\[endpoint_unreachable\] AppError: libretranslate: http 500 — /)
    expect(message.length).toBeLessThan(300)
  })
})
