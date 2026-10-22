import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'
import {
  SUPPORTED_TARGETS,
  type PackageTarget,
} from '@scripts/packaging/targets'

interface WorkflowStep {
  name?: string
  id?: string
  if?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface MatrixEntry {
  platform: string
  arch: string
  runner: string
}

interface WorkflowJob {
  name?: string
  needs?: string
  uses?: string
  'runs-on'?: string
  defaults?: { run?: { shell?: string } }
  strategy?: {
    matrix?: {
      include?: MatrixEntry[]
      os?: string[]
    }
  }
  steps?: WorkflowStep[]
}

interface Workflow {
  on: Record<string, {
    branches?: string[]
    inputs?: Record<string, {
      type?: string
      default?: unknown
    }>
  } | null>
  jobs: Record<string, WorkflowJob>
}

const rootDir: string = resolve(__dirname, '..', '..', '..')

function loadWorkflow(file: string): Workflow {
  return yamlParse(readFileSync(resolve(rootDir, '.github', 'workflows', file), 'utf8')) as Workflow
}

function requireJob(workflow: Workflow, name: string): WorkflowJob {
  const found: WorkflowJob | undefined = workflow.jobs[name]

  if (!found) {
    throw new Error(`missing job ${name}`)
  }

  return found
}

const packageWorkflow: Workflow = loadWorkflow('package.yml')
const packageJob: WorkflowJob = requireJob(packageWorkflow, 'package')
const packageSteps: WorkflowStep[] = packageJob.steps ?? []

function packageStep(name: string): WorkflowStep {
  const found: WorkflowStep | undefined = packageSteps.find(
    (step: WorkflowStep): boolean => step.name === name,
  )

  if (!found) {
    throw new Error(`package job has no step "${name}"`)
  }

  return found
}

function stepIndex(name: string): number {
  return packageSteps.findIndex((step: WorkflowStep): boolean => step.name === name)
}

describe('package.yml', () => {
  it('is reusable and manually dispatchable with a cache toggle', () => {
    expect(Object.keys(packageWorkflow.on).sort()).toEqual(['workflow_call', 'workflow_dispatch'])
    expect(packageWorkflow.on.workflow_call?.inputs?.['cache-dependencies']).toEqual(expect.objectContaining({
      type: 'boolean',
      default: true,
    }))
    expect(packageStep('Setup workspace').uses).toBe('./.github/actions/setup-workspace')
    expect(packageStep('Setup workspace').with?.cache).toBe('${{ inputs.cache-dependencies }}')
  })

  it('builds exactly the supported platform-arch targets', () => {
    const matrix: MatrixEntry[] = packageJob.strategy?.matrix?.include ?? []

    expect(matrix.map((entry: MatrixEntry): PackageTarget => ({
      platform: entry.platform,
      arch: entry.arch,
    } as PackageTarget))).toEqual(SUPPORTED_TARGETS)
  })

  it.each([
    ['mac', 'arm64', 'macos-latest'],
    ['mac', 'x64', 'macos-26-intel'],
    ['win', 'x64', 'windows-latest'],
    ['linux', 'x64', 'ubuntu-latest'],
  ])('builds %s-%s natively on %s', (platform: string, arch: string, runner: string) => {
    const targetId: string = `${platform}-${arch}`
    const entry: MatrixEntry | undefined = packageJob.strategy?.matrix?.include?.find(
      (candidate: MatrixEntry): boolean => `${candidate.platform}-${candidate.arch}` === targetId,
    )

    expect(entry?.runner).toBe(runner)
  })

  it('runs POSIX shell steps through bash on every runner, including Windows', () => {
    expect(packageJob.defaults?.run?.shell).toBe('bash')
  })

  it('packages, verifies, smoke-tests, then uploads', () => {
    const order: number[] = [
      'Build + package',
      'Verify package',
      'Locate packaged executable and installers',
      'Packaged smoke test (Linux, xvfb-wrapped)',
      'Packaged smoke test (macOS / Windows)',
      'Upload installers',
    ].map(stepIndex)

    expect(order.every((index: number): boolean => index >= 0)).toBe(true)
    expect([...order].sort((left: number, right: number): number => left - right)).toEqual(order)
  })

  it('passes the matrix target to the package and verify scripts', () => {
    expect(packageStep('Build + package').run).toBe('node scripts/package.mjs --arch=${{ matrix.arch }}')
    expect(packageStep('Verify package').run)
      .toBe('node scripts/verify-package.mjs --platform ${{ matrix.platform }} --arch ${{ matrix.arch }}')
  })

  it('points the packaged smoke test at the verified executable', () => {
    const locate: WorkflowStep = packageStep('Locate packaged executable and installers')

    expect(locate.run).toContain('--print executable')
    expect(locate.run).toContain('OPENTRANSLATE_PACKAGED_APP=')
    expect(locate.run).toContain('--print installers')
  })

  it('wraps the Linux smoke test in xvfb-run', () => {
    const linuxSmoke: WorkflowStep = packageStep('Packaged smoke test (Linux, xvfb-wrapped)')

    expect(linuxSmoke.if).toBe("matrix.platform == 'linux'")
    expect(linuxSmoke.run).toMatch(/^xvfb-run .* pnpm run test:e2e:packaged$/)
    expect(packageStep('Packaged smoke test (macOS / Windows)').run).toBe('pnpm run test:e2e:packaged')
  })

  it('uploads only the verified installers as package-<platform>-<arch>', () => {
    const upload: WorkflowStep = packageStep('Upload installers')

    expect(upload.with?.name).toBe('package-${{ matrix.platform }}-${{ matrix.arch }}')
    expect(upload.with?.path).toBe('${{ steps.locate.outputs.installers }}')
    expect(upload.with?.['if-no-files-found']).toBe('error')
    expect(packageStep('Locate packaged executable and installers').id).toBe('locate')
  })
})

describe('ci.yml', () => {
  const ci: Workflow = loadWorkflow('ci.yml')

  it('runs once per PR: pushes only to the long-lived branches, PRs into them', () => {
    expect(ci.on.push?.branches).toEqual(['master', 'develop'])
    expect(ci.on.pull_request?.branches).toEqual(['master', 'develop'])
  })

  it('runs the shared checks, then packages every target', () => {
    expect(requireJob(ci, 'checks').uses).toBe('./.github/workflows/checks.yml')
    expect(requireJob(ci, 'package').needs).toBe('checks')
    expect(requireJob(ci, 'package').uses).toBe('./.github/workflows/package.yml')
  })
})

describe('checks.yml', () => {
  const checks: Workflow = loadWorkflow('checks.yml')
  const checksJob: WorkflowJob = requireJob(checks, 'lint-typecheck-test')
  const stepNames: string[] = (checksJob.steps ?? []).map((step: WorkflowStep): string => step.name ?? '')

  it('is reusable', () => {
    expect(Object.keys(checks.on)).toEqual(['workflow_call'])
  })

  it('keeps the lint / typecheck / test / e2e OS matrix', () => {
    expect(checksJob.strategy?.matrix?.os).toEqual(['ubuntu-latest', 'macos-latest', 'windows-latest'])
    expect(stepNames).toEqual(expect.arrayContaining([
      'Lint',
      'Typecheck',
      'Unit + integration tests',
      'E2E Linux (xvfb-wrapped)',
      'E2E macOS / Windows',
    ]))
  })

  it('runs unit tests before e2e', () => {
    expect(stepNames.indexOf('Unit + integration tests')).toBeLessThan(stepNames.indexOf('E2E macOS / Windows'))
  })
})
