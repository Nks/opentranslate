import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync, existsSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'

const rootDir = resolve(__dirname, '..', '..', '..')
const scriptPath = resolve(rootDir, 'scripts/package.mjs')

describe('scripts/package.mjs', () => {
  it('exists', () => {
    expect(existsSync(scriptPath)).toBe(true)
  })

  it('imports build-related modules', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain('execSync')
    expect(content).toContain('child_process')
  })

  it('runs build:electron step', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain('build:electron')
  })

  it('runs build:renderer step', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain('build:renderer')
  })

  it('invokes electron-builder', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain('electron-builder')
  })

  it('supports --dir flag for unpacked output', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain('--dir')
  })

  it('sets NODE_ENV to production', () => {
    const content = readFileSync(scriptPath, 'utf8')

    expect(content).toContain("NODE_ENV: 'production'")
  })
})

describe('scripts/build-electron.mjs', () => {
  const buildScriptPath = resolve(rootDir, 'scripts/build-electron.mjs')

  it('exists', () => {
    expect(existsSync(buildScriptPath)).toBe(true)
  })

  it('bundles main and preload as CJS', () => {
    const content = readFileSync(buildScriptPath, 'utf8')

    expect(content).toContain("format: 'cjs'")
    expect(content).toContain('main.cjs')
    expect(content).toContain('preload.cjs')
  })

  it('externalizes electron and better-sqlite3', () => {
    const content = readFileSync(buildScriptPath, 'utf8')

    expect(content).toContain("'electron'")
    expect(content).toContain("'better-sqlite3'")
  })
})
