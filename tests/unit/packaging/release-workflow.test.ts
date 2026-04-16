import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync, existsSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'

const rootDir = resolve(__dirname, '..', '..', '..')

function loadWorkflow(name: string): Record<string, unknown> {
  const raw = readFileSync(resolve(rootDir, `.github/workflows/${name}`), 'utf8')

  return yamlParse(raw) as Record<string, unknown>
}

describe('release.yml workflow', () => {
  const workflowPath = resolve(rootDir, '.github/workflows/release.yml')

  it('exists', () => {
    expect(existsSync(workflowPath)).toBe(true)
  })

  it('triggers on version tags', () => {
    const wf = loadWorkflow('release.yml')
    const on = wf.on as Record<string, unknown>
    const push = on.push as Record<string, unknown>
    const tags = push.tags as string[]

    expect(tags).toContain('v*')
  })

  it('has contents write permission', () => {
    const wf = loadWorkflow('release.yml')
    const perms = wf.permissions as Record<string, unknown>

    expect(perms.contents).toBe('write')
  })

  it('builds on all three platforms', () => {
    const wf = loadWorkflow('release.yml')
    const jobs = wf.jobs as Record<string, unknown>
    const build = jobs.build as Record<string, unknown>
    const strategy = build.strategy as Record<string, unknown>
    const matrix = strategy.matrix as Record<string, unknown>
    const include = matrix.include as Array<{
      os: string
      platform: string
    }>
    const platforms = include.map((item) => item.platform)

    expect(platforms).toContain('mac')
    expect(platforms).toContain('win')
    expect(platforms).toContain('linux')
  })

  it('runs tests before packaging', () => {
    const wf = loadWorkflow('release.yml')
    const jobs = wf.jobs as Record<string, unknown>
    const build = jobs.build as Record<string, unknown>
    const steps = build.steps as Array<{ name: string }>
    const stepNames = steps.map((step) => step.name)

    const testIdx = stepNames.indexOf('Unit + integration tests')
    const packageMacIdx = stepNames.indexOf('Package (macOS)')

    expect(testIdx).toBeGreaterThan(-1)
    expect(packageMacIdx).toBeGreaterThan(-1)
    expect(testIdx).toBeLessThan(packageMacIdx)
  })

  it('publishes release as draft', () => {
    const wf = loadWorkflow('release.yml')
    const jobs = wf.jobs as Record<string, unknown>
    const publish = jobs.publish as Record<string, unknown>
    const steps = publish.steps as Array<{
      name: string
      with?: Record<string, unknown>
    }>
    const releaseStep = steps.find((step) => step.name === 'Create GitHub Release')

    expect(releaseStep).toBeDefined()
    expect(releaseStep!.with?.draft).toBe(true)
  })

  it('publish job depends on build', () => {
    const wf = loadWorkflow('release.yml')
    const jobs = wf.jobs as Record<string, unknown>
    const publish = jobs.publish as Record<string, unknown>

    expect(publish.needs).toBe('build')
  })
})

describe('ci.yml workflow', () => {
  it('exists', () => {
    expect(existsSync(resolve(rootDir, '.github/workflows/ci.yml'))).toBe(true)
  })

  it('runs on push to feature branches', () => {
    const wf = loadWorkflow('ci.yml')
    const on = wf.on as Record<string, unknown>
    const push = on.push as Record<string, unknown>
    const branches = push.branches as string[]

    expect(branches).toContain('feature/**')
  })
})
