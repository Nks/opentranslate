import {
  afterEach, beforeEach, describe, expect, it, vi, type MockInstance,
} from 'vitest'
import {
  mkdir, mkdtemp, readFile, realpath, rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as OutputFileModule from '@electron/services/documents/output-file'

vi.mock('node:crypto', () => ({
  randomUUID: (): string => 'fixed-id',
}))

const { writeDocumentAtomically }: typeof OutputFileModule = await import(
  '@electron/services/documents/output-file'
)

describe.skipIf(process.platform === 'win32')('writeDocumentAtomically — Zone.Identifier failure', () => {
  let dir: string
  let errorLog: MockInstance<(...args: unknown[]) => void>

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-zone-')))
    errorLog = vi.spyOn(console, 'error').mockImplementation((): void => undefined)
  })

  afterEach(async () => {
    errorLog.mockRestore()
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('still saves the file and logs the code when the volume cannot store the mark', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.txt')
    await mkdir(`${outputPath}.fixed-id.partial:Zone.Identifier`)

    await writeDocumentAtomically(outputPath, new TextEncoder().encode('ok'), 'win32')

    expect(await readFile(outputPath, 'utf8')).toBe('ok')
    expect(errorLog).toHaveBeenCalledOnce()
    expect(String(errorLog.mock.calls[0]?.[0])).toContain('Zone.Identifier')
    expect(JSON.stringify(errorLog.mock.calls[0])).not.toContain(dir)
  })
})
