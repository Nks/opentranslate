import {
  describe, expect, it, vi,
} from 'vitest'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  electronState,
  invoke,
  requestsTo,
  useDocumentIpcHarness,
  type DocumentIpcHarness,
} from '@tests/support/document-ipc-harness'

vi.mock('electron', async () => (await import('@tests/support/document-ipc-harness')).electronModule)

vi.mock('@electron/services/history/store', () => ({
  createHistoryStore: (): Record<string, never> => ({}),
}))

type DropTarget = (dir: string) => string

const harness: DocumentIpcHarness = useDocumentIpcHarness()

function translate(filePath: string): Promise<unknown> {
  return invoke('document:translate', {
    filePath,
    sourceLanguage: { mode: 'auto' },
    targetLanguage: 'ru',
  })
}

describe('document selection through the IPC handler layer', () => {
  it('returns the name and extension main resolved for a pick', async () => {
    const filePath: string = join(harness.docsDir, 'Notes.TXT')
    await writeFile(filePath, 'Hello')
    electronState.nextPick = filePath

    expect(await invoke('document:pick')).toEqual({
      filePath,
      fileName: 'Notes.TXT',
      extension: '.txt',
    })
  })

  it('rejects a picked extension the deployment does not list, naming the supported formats', async () => {
    const filePath: string = join(harness.docsDir, 'report.pdf')
    await writeFile(filePath, '%PDF-1.7')

    await expect(harness.pick(filePath)).rejects.toThrow(
      /^\[unsupported_document_type\] .*unsupported file type "\.pdf" — Supported formats: \.txt, \.odt$/,
    )
    await expect(translate(filePath)).rejects.toThrow(/not selected through the document picker$/)
    expect(requestsTo(harness.libre, '/translate_file')).toHaveLength(0)
  })

  it.each<[string, DropTarget, RegExp]>([
    ['a directory', (dir: string): string => dir, /^\[unsupported_document_type\] .*not a regular file/],
    ['a network path', (): string => '\\\\attacker\\share\\notes.txt', /^\[unsupported_document_type\] .*network paths/],
    ['a missing file', (dir: string): string => join(dir, 'gone.txt'), /^\[internal_app_error\] .*could not be opened/],
  ])('refuses to register a dropped %s', async (_label: string, target: DropTarget, error: RegExp) => {
    await expect(invoke('document:drop', { filePath: target(harness.docsDir) })).rejects.toThrow(error)
  })

  it.each<[string, unknown]>([
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
    await harness.sourceFile('picked.txt', 'ok')
    const unpicked: string = join(harness.docsDir, 'secrets.txt')
    await writeFile(unpicked, 'do not exfiltrate')

    await expect(translate(unpicked)).rejects.toThrow(
      /^\[internal_app_error\] .*not selected through the document picker$/,
    )
    expect(requestsTo(harness.libre, '/translate_file')).toHaveLength(0)
  })

  it('requires a new pick after the provider was switched', async () => {
    const filePath: string = await harness.sourceFile('notes.txt', 'Hello')
    await invoke('provider:switch', { providerId: 'libretranslate' })

    await expect(translate(filePath)).rejects.toThrow(/provider changed since the file was selected/)
    expect(requestsTo(harness.libre, '/translate_file')).toHaveLength(0)
  })

  it('rejects a relative path at selection with a normalized error and no upload', async () => {
    await expect(harness.pick('notes.txt')).rejects.toThrow(
      /^\[internal_app_error\] AppError: document: file path must be absolute$/,
    )
    expect(requestsTo(harness.libre, '/translate_file')).toHaveLength(0)
  })
})
