import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync, readdirSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
}

interface WorkflowJob {
  'runs-on'?: string
  'timeout-minutes'?: number
  permissions?: Record<string, string>
  env?: Record<string, string>
  steps?: WorkflowStep[]
}

interface Workflow {
  on: Record<string, {
    branches?: string[]
  } | null>
  permissions?: Record<string, string>
  jobs: Record<string, WorkflowJob>
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const workflowsDir: string = resolve(rootDir, '.github', 'workflows')
const workflowFiles: string[] = readdirSync(workflowsDir)
  .filter((file: string): boolean => file.endsWith('.yml'))
  .sort()

const USES_LINE: RegExp = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/
const PINNED_ACTION: RegExp = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/
const VERSION_COMMENT: RegExp = /^\s+# v\d+\.\d+\.\d+$/

function readWorkflowText(file: string): string {
  return readFileSync(resolve(workflowsDir, file), 'utf8')
}

function loadWorkflow(file: string): Workflow {
  return yamlParse(readWorkflowText(file)) as Workflow
}

function allSteps(workflow: Workflow): WorkflowStep[] {
  return Object.values(workflow.jobs).flatMap((job: WorkflowJob): WorkflowStep[] => job.steps ?? [])
}

function stepsUsing(workflow: Workflow, action: string): WorkflowStep[] {
  return allSteps(workflow).filter((step: WorkflowStep): boolean => step.uses?.startsWith(`${action}@`) === true)
}

describe('workflow inventory', () => {
  it('ships the CI, reusable, release and scanning workflows', () => {
    expect(workflowFiles).toEqual([
      'checks.yml',
      'ci.yml',
      'codeql.yml',
      'package.yml',
      'release.yml',
      'security-scan.yml',
    ])
  })
})

describe.each(workflowFiles)('%s', (file: string) => {
  it('pins every external action to a full commit SHA with a version comment', () => {
    const usesLines: RegExpMatchArray[] = readWorkflowText(file)
      .split('\n')
      .map((line: string): RegExpMatchArray | null => USES_LINE.exec(line))
      .filter((match: RegExpMatchArray | null): match is RegExpMatchArray => match !== null)
      .filter((match: RegExpMatchArray): boolean => !match[1]?.startsWith('./'))

    usesLines.forEach((match: RegExpMatchArray): void => {
      expect(match[1]).toMatch(PINNED_ACTION)
      expect(match[2]).toMatch(VERSION_COMMENT)
    })
  })

  it('defaults the GITHUB_TOKEN to read-only contents', () => {
    expect(loadWorkflow(file).permissions).toEqual({
      contents: 'read',
    })
  })

  it('never triggers on a non-existent main branch', () => {
    const triggers: Workflow['on'] = loadWorkflow(file).on
    const branches: string[] = Object.values(triggers)
      .flatMap((trigger: { branches?: string[] } | null): string[] => trigger?.branches ?? [])

    expect(branches).not.toContain('main')
  })

  it('checks out without persisting credentials', () => {
    stepsUsing(loadWorkflow(file), 'actions/checkout').forEach((step: WorkflowStep): void => {
      expect(step.with?.['persist-credentials']).toBe(false)
    })
  })

  it('bounds every runner job with timeout-minutes', () => {
    Object.values(loadWorkflow(file).jobs)
      .filter((job: WorkflowJob): boolean => job['runs-on'] !== undefined)
      .forEach((job: WorkflowJob): void => {
        expect(job['timeout-minutes']).toBeGreaterThan(0)
        expect(job['timeout-minutes']).toBeLessThanOrEqual(60)
      })
  })

  it('never interpolates expressions into run scripts (passes them through env instead)', () => {
    allSteps(loadWorkflow(file))
      .filter((step: WorkflowStep): boolean => step.run !== undefined)
      .forEach((step: WorkflowStep): void => {
        expect(step.run).not.toContain('${{')
      })
  })

  it('lets pnpm/action-setup read the pnpm version from packageManager', () => {
    stepsUsing(loadWorkflow(file), 'pnpm/action-setup').forEach((step: WorkflowStep): void => {
      expect(step.with?.version).toBeUndefined()
    })
  })
})

describe.each(['ci.yml', 'codeql.yml', 'security-scan.yml'])('%s branch triggers', (file: string) => {
  it('runs on pushes and pull requests to master and develop', () => {
    const triggers: Workflow['on'] = loadWorkflow(file).on

    expect(triggers.push?.branches).toEqual(expect.arrayContaining(['master', 'develop']))
    expect(triggers.pull_request?.branches).toEqual(['master', 'develop'])
  })
})

describe('security-scan.yml', () => {
  const text: string = readWorkflowText('security-scan.yml')
  const steps: WorkflowStep[] = allSteps(loadWorkflow('security-scan.yml'))
  const securityDoc: string = readFileSync(resolve(rootDir, 'docs', 'security.md'), 'utf8')
  const EXCLUDED_PACKAGES: RegExp = /--excludePackages "([^"]+)"/
  const BARE_PACKAGE_NAME: RegExp = /^(?:@[\w.-]+\/)?[\w.-]+$/

  function stepNamed(name: string): WorkflowStep | undefined {
    return steps.find((step: WorkflowStep): boolean => step.name === name)
  }

  function licenseExclusions(): string[] {
    const match: RegExpExecArray | null = EXCLUDED_PACKAGES.exec(stepNamed('Check licenses')?.run ?? '')

    return match?.[1]?.split(';') ?? []
  }

  it('runs Semgrep from a versioned image pinned by digest', () => {
    const semgrepStep: WorkflowStep | undefined = stepNamed('Run Semgrep')

    expect(semgrepStep?.run).toMatch(/semgrep\/semgrep:\d+\.\d+\.\d+@sha256:[0-9a-f]{64} /)
    expect(text).not.toContain('returntocorp/semgrep')
    expect(text).not.toContain(':latest')
  })

  it('runs Semgrep from an image at least as old as the 7-day dependency cooldown', () => {
    expect(stepNamed('Run Semgrep')?.run).toContain(
      'semgrep/semgrep:1.181.0@sha256:81474464c1f07483ba0682a44787fd93c91397419762a04abe2bafaae396304b',
    )
  })

  it('lets gitleaks read PR commits without any write scope', () => {
    const gitleaks: WorkflowJob | undefined = loadWorkflow('security-scan.yml').jobs.gitleaks
    const gitleaksStep: WorkflowStep | undefined = stepNamed('Run gitleaks')

    expect(gitleaks?.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'read',
    })
    expect(gitleaksStep?.env?.GITLEAKS_ENABLE_COMMENTS).toBe('false')
  })

  it('audits devDependencies too, because the shipped bundles are built from them', () => {
    expect(stepNamed('pnpm audit')?.run).toBe('pnpm audit --audit-level=high')
  })

  it('lets Trivy scan devDependencies as well', () => {
    expect(stepNamed('Run Trivy filesystem scan')?.env?.TRIVY_INCLUDE_DEV_DEPS).toBe('true')
  })

  it('checks licenses across the full tree instead of production dependencies only', () => {
    const licenseStep: WorkflowStep | undefined = stepNamed('Check licenses')

    expect(licenseStep?.run).not.toContain('--production')
    expect(licenseStep?.run).toContain('--excludePrivatePackages')
    expect(licenseStep?.run).toMatch(/license-checker-rseidelsohn@\d+\.\d+\.\d+/)
  })

  it('excludes license-check packages by bare name, never by hardcoded version', () => {
    expect(licenseExclusions().length).toBeGreaterThan(0)
    licenseExclusions().forEach((name: string): void => {
      expect(name).toMatch(BARE_PACKAGE_NAME)
    })
  })

  it('documents every license-check exclusion in docs/security.md', () => {
    licenseExclusions().forEach((name: string): void => {
      expect(securityDoc).toContain(`\`${name}\``)
    })
  })

  it('documents every ignored advisory in docs/security.md', () => {
    const pkg: { pnpm?: { auditConfig?: { ignoreGhsas?: string[] } } } = JSON.parse(
      readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
    ) as { pnpm?: { auditConfig?: { ignoreGhsas?: string[] } } }
    const ignored: string[] = pkg.pnpm?.auditConfig?.ignoreGhsas ?? []

    expect(ignored.length).toBeGreaterThan(0)
    ignored.forEach((ghsa: string): void => {
      expect(ghsa).toMatch(/^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/)
      expect(securityDoc).toContain(ghsa)
    })
  })
})

describe('dependabot.yml', () => {
  interface DependabotUpdate {
    'package-ecosystem': string
    cooldown?: { 'default-days'?: number }
  }

  const config: { updates: DependabotUpdate[] } = yamlParse(
    readFileSync(resolve(rootDir, '.github', 'dependabot.yml'), 'utf8'),
  ) as { updates: DependabotUpdate[] }

  it('covers npm and github-actions', () => {
    expect(config.updates.map((update: DependabotUpdate): string => update['package-ecosystem']))
      .toEqual(['npm', 'github-actions'])
  })

  it.each(['npm', 'github-actions'])('waits 7 days before proposing %s updates', (ecosystem: string) => {
    const update: DependabotUpdate | undefined = config.updates.find(
      (candidate: DependabotUpdate): boolean => candidate['package-ecosystem'] === ecosystem,
    )

    expect(update?.cooldown?.['default-days']).toBe(7)
  })
})
