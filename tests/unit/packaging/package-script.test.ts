import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync, existsSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import type {
  PlaywrightTestConfig,
} from '@playwright/test'

interface PlaywrightProject {
  name?: string
  testMatch?: string[]
  testIgnore?: string[]
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const scriptPath: string = resolve(rootDir, 'scripts/package.mjs')
const verifyScriptPath: string = resolve(rootDir, 'scripts/verify-package.mjs')
const pkg: { scripts: Record<string, string> } = JSON.parse(
  readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> }

async function loadPlaywrightProjects(): Promise<PlaywrightProject[]> {
  const configModule: { default: PlaywrightTestConfig } = await import(resolve(rootDir, 'playwright.config.ts'))

  return (configModule.default.projects ?? []) as PlaywrightProject[]
}

describe('scripts/package.mjs', () => {
  const content: string = readFileSync(scriptPath, 'utf8')

  it('exists', () => {
    expect(existsSync(scriptPath)).toBe(true)
  })

  it('parses CLI args and runs the unit-tested packaging plan', () => {
    expect(content).toContain("from './packaging/targets.ts'")
    expect(content).toContain("from './packaging/package-plan.ts'")
    expect(content).toContain('parsePackageCliArgs(process.argv.slice(2), process.platform)')
    expect(content).toContain('planPackageCommands(request)')
  })

  it('does not hardcode builder invocations outside the plan', () => {
    expect(content).not.toMatch(/electron-builder --(mac|win|linux)/)
  })

  it('runs commands with execSync and NODE_ENV=production', () => {
    expect(content).toContain('execSync')
    expect(content).toContain("NODE_ENV: 'production'")
  })
})

describe('scripts/verify-package.mjs', () => {
  const content: string = readFileSync(verifyScriptPath, 'utf8')

  it('exists', () => {
    expect(existsSync(verifyScriptPath)).toBe(true)
  })

  it('delegates header parsing and layout to the unit-tested modules', () => {
    expect(content).toContain("from './packaging/binary-arch.ts'")
    expect(content).toContain("from './packaging/artifact-layout.ts'")
    expect(content).toContain('parseVerifyCliArgs(process.argv.slice(2))')
  })

  it('exits non-zero when any check fails', () => {
    expect(content).toContain('process.exit(1)')
  })
})

describe('package.json scripts', () => {
  it('keeps package and package:dir entry points', () => {
    expect(pkg.scripts.package).toBe('node scripts/package.mjs')
    expect(pkg.scripts['package:dir']).toBe('node scripts/package.mjs --dir')
  })

  it('exposes verify:package', () => {
    expect(pkg.scripts['verify:package']).toBe('node scripts/verify-package.mjs')
  })

  it('keeps the packaged smoke test out of the default e2e run', () => {
    expect(pkg.scripts['test:e2e']).toBe('playwright test --project=electron-dev')
    expect(pkg.scripts['test:e2e:packaged']).toBe('playwright test --project=electron-packaged')
  })
})

describe('playwright projects', () => {
  it('ignores packaged-*.e2e.ts in the dev project', async () => {
    const projects: PlaywrightProject[] = await loadPlaywrightProjects()
    const dev: PlaywrightProject | undefined = projects.find(
      (project: PlaywrightProject): boolean => project.name === 'electron-dev',
    )

    expect(dev?.testMatch).toEqual(['**/*.e2e.ts'])
    expect(dev?.testIgnore).toEqual(['**/packaged-*.e2e.ts'])
  })

  it('runs only packaged-*.e2e.ts in the packaged project', async () => {
    const projects: PlaywrightProject[] = await loadPlaywrightProjects()
    const packaged: PlaywrightProject | undefined = projects.find(
      (project: PlaywrightProject): boolean => project.name === 'electron-packaged',
    )

    expect(packaged?.testMatch).toEqual(['**/packaged-*.e2e.ts'])
  })
})

describe('scripts/build-electron.mjs', () => {
  const buildScriptPath: string = resolve(rootDir, 'scripts/build-electron.mjs')

  it('exists', () => {
    expect(existsSync(buildScriptPath)).toBe(true)
  })

  it('bundles main and preload as CJS', () => {
    const content: string = readFileSync(buildScriptPath, 'utf8')

    expect(content).toContain("format: 'cjs'")
    expect(content).toContain('main.cjs')
    expect(content).toContain('preload.cjs')
  })

  it('externalizes Electron and other native modules', () => {
    const content: string = readFileSync(buildScriptPath, 'utf8')

    expect(content).toContain("'electron'")
    expect(content).toContain("'uiohook-napi'")
  })
})
