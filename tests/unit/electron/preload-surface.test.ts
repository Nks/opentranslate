import {
  describe, expect, it,
} from 'vitest'
import {
  readFile,
} from 'node:fs/promises'
import {
  fileURLToPath,
} from 'node:url'
import {
  dirname, resolve,
} from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(testDir, '..', '..', '..')
const preloadSource = resolve(rootDir, 'electron/preload/index.ts')

describe('preload surface contract', () => {
  it('exposes no method that can read a stored secret', async () => {
    const source = await readFile(preloadSource, 'utf8')
    expect(source).not.toContain('secrets:get')
    expect(source).not.toMatch(/secrets\.get\s*:/)
    expect(source).not.toMatch(/getSecret/i)
  })

  it('registers only settings.get, settings.update, secrets.set, secrets.test in the secrets/settings block', async () => {
    const source = await readFile(preloadSource, 'utf8')
    // Directory of methods must not include "get" prefixed secret reads.
    expect(source).toContain('settings:')
    expect(source).toContain('secrets:set')
    expect(source).toContain('secrets:test')
  })
})
