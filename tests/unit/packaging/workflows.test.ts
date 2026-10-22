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
}

interface WorkflowJob {
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

  it('runs Semgrep from a versioned image pinned by digest', () => {
    const semgrepStep: WorkflowStep | undefined = steps.find(
      (step: WorkflowStep): boolean => step.name === 'Run Semgrep',
    )

    expect(semgrepStep?.run).toMatch(/semgrep\/semgrep:\d+\.\d+\.\d+@sha256:[0-9a-f]{64} /)
    expect(text).not.toContain('returntocorp/semgrep')
    expect(text).not.toContain(':latest')
  })

  it('excludes private packages from the license check instead of a hardcoded version', () => {
    const licenseStep: WorkflowStep | undefined = steps.find(
      (step: WorkflowStep): boolean => step.name === 'Check production licenses',
    )

    expect(licenseStep?.run).toContain('--excludePrivatePackages')
    expect(licenseStep?.run).not.toContain('--excludePackages')
    expect(licenseStep?.run).toMatch(/license-checker-rseidelsohn@\d+\.\d+\.\d+/)
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
