import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest'
import {
  mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ZONE_IDENTIFIER_CONTENT,
  writeDocumentAtomically,
} from '@electron/services/documents/output-file'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

const IS_WINDOWS: boolean = process.platform === 'win32'

describe('writeDocumentAtomically', () => {
  let dir: string

  beforeEach(async () => {
    dir = await realpath(await mkdtemp(join(tmpdir(), 'ot-doc-out-')))
  })

  afterEach(async () => {
    await rm(dir, {
      recursive: true,
      force: true,
    })
  })

  it('writes the bytes unmodified and leaves no partial file', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.pdf')
    const bytes: Uint8Array = new Uint8Array([0, 255, 10, 13, 0])

    await writeDocumentAtomically(outputPath, bytes)

    expect(Array.from(await readFile(outputPath))).toEqual([0, 255, 10, 13, 0])
    expect(await readdir(dir)).toEqual(['report.ru.translated.pdf'])
  })

  it.runIf(IS_WINDOWS)('marks the saved file as downloaded from the internet (Zone.Identifier)', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.pdf')

    await writeDocumentAtomically(outputPath, new Uint8Array([1]))

    expect(await readFile(`${outputPath}:Zone.Identifier`, 'utf8')).toBe(ZONE_IDENTIFIER_CONTENT)
  })

  it.skipIf(IS_WINDOWS)('writes the Zone.Identifier stream before the rename on win32', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.pdf')

    await writeDocumentAtomically(outputPath, new Uint8Array([1]), 'win32')

    const entries: string[] = await readdir(dir)
    const zoneEntry: string | undefined = entries.find(
      (entry: string): boolean => entry.endsWith('.partial:Zone.Identifier'),
    )
    expect(zoneEntry).toBeDefined()
    expect(await readFile(join(dir, zoneEntry ?? ''), 'utf8')).toBe(ZONE_IDENTIFIER_CONTENT)
    expect(ZONE_IDENTIFIER_CONTENT).toBe('[ZoneTransfer]\r\nZoneId=3\r\n')
  })

  it.skipIf(IS_WINDOWS)('adds no Zone.Identifier on other platforms', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.pdf')

    await writeDocumentAtomically(outputPath, new Uint8Array([1]), 'darwin')

    expect(await readdir(dir)).toEqual(['report.ru.translated.pdf'])
  })

  it('replaces a previous translation', async () => {
    const outputPath: string = join(dir, 'report.ru.translated.txt')
    await writeFile(outputPath, 'old')

    await writeDocumentAtomically(outputPath, new TextEncoder().encode('new'))

    expect(await readFile(outputPath, 'utf8')).toBe('new')
  })

  it.skipIf(IS_WINDOWS)('replaces a symlink at the output path instead of writing through it', async () => {
    const victim: string = join(dir, 'victim.txt')
    const outputPath: string = join(dir, 'report.ru.translated.txt')
    await writeFile(victim, 'keep me')
    await symlink(victim, outputPath)

    await writeDocumentAtomically(outputPath, new TextEncoder().encode('translated'))

    expect(await readFile(victim, 'utf8')).toBe('keep me')
    expect(await readFile(outputPath, 'utf8')).toBe('translated')
  })

  it('maps a failed save to InternalAppError and cleans up the partial file', async () => {
    const outputPath: string = join(dir, 'occupied.ru.translated.txt')
    await mkdir(outputPath)
    await writeFile(join(outputPath, 'child'), 'x')

    const err: unknown = await writeDocumentAtomically(outputPath, new Uint8Array([1])).then(
      (): never => {
        throw new Error('expected rejection')
      },
      (caught: unknown): unknown => caught,
    )

    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).category).toBe(ErrorCategory.InternalAppError)
    expect((err as AppError).message).not.toContain(dir)
    expect(await readdir(dir)).toEqual(['occupied.ru.translated.txt'])
  })
})
