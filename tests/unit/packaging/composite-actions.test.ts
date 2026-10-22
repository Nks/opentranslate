import {
  describe, expect, it,
} from 'vitest'
import {
  existsSync, readFileSync, readdirSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'

interface Step {
  name?: string
  uses?: string
  run?: string
  shell?: string
  if?: string
  with?: Record<string, unknown>
}

interface CompositeAction {
  inputs?: Record<string, {
    default?: string
  }>
  runs: {
    using: string
    steps: Step[]
  }
}

interface WorkflowJob {
  steps?: Step[]
}

interface Workflow {
  jobs: Record<string, WorkflowJob>
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const actionsDir: string = resolve(rootDir, '.github', 'actions')
const workflowsDir: string = resolve(rootDir, '.github', 'workflows')
const SETUP_WORKSPACE: string = './.github/actions/setup-workspace'
const LINUX_ELECTRON_DEPS: string = './.github/actions/linux-electron-deps'
const USES_LINE: RegExp = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/
const PINNED_ACTION: RegExp = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/
const VERSION_COMMENT: RegExp = /^\s+# v\d+\.\d+\.\d+$/

const actionNames: string[] = readdirSync(actionsDir).sort()
const workflowFiles: string[] = readdirSync(workflowsDir)
  .filter((file: string): boolean => file.endsWith('.yml'))
  .sort()

function actionPath(name: string): string {
  return resolve(actionsDir, name, 'action.yml')
}

function loadAction(name: string): CompositeAction {
  return yamlParse(readFileSync(actionPath(name), 'utf8')) as CompositeAction
}

function loadWorkflow(file: string): Workflow {
  return yamlParse(readFileSync(resolve(workflowsDir, file), 'utf8')) as Workflow
}

function jobSteps(file: string): Step[][] {
  return Object.values(loadWorkflow(file).jobs).map((job: WorkflowJob): Step[] => job.steps ?? [])
}

function stepUsing(steps: Step[], action: string): Step | undefined {
  return steps.find((step: Step): boolean => step.uses?.startsWith(action) === true)
}

describe('composite action inventory', () => {
  it('ships the shared workspace setup and Linux Electron deps actions', () => {
    expect(actionNames).toEqual(['linux-electron-deps', 'setup-workspace'])
    actionNames.forEach((name: string): void => {
      expect(existsSync(actionPath(name))).toBe(true)
      expect(loadAction(name).runs.using).toBe('composite')
    })
  })
})

describe.each(actionNames)('%s action', (name: string) => {
  it('pins every external action to a full commit SHA with a version comment', () => {
    readFileSync(actionPath(name), 'utf8')
      .split('\n')
      .map((line: string): RegExpExecArray | null => USES_LINE.exec(line))
      .filter((match: RegExpExecArray | null): match is RegExpExecArray => match !== null)
      .forEach((match: RegExpExecArray): void => {
        expect(match[1]).toMatch(PINNED_ACTION)
        expect(match[2]).toMatch(VERSION_COMMENT)
      })
  })

  it('runs every script step under bash and never interpolates expressions into it', () => {
    loadAction(name).runs.steps
      .filter((step: Step): boolean => step.run !== undefined)
      .forEach((step: Step): void => {
        expect(step.shell).toBe('bash')
        expect(step.run).not.toContain('${{')
      })
  })
})

describe('setup-workspace action', () => {
  const action: CompositeAction = loadAction('setup-workspace')
  const steps: Step[] = action.runs.steps

  it('restores the pnpm store cache unless the caller turns it off', () => {
    expect(action.inputs?.cache?.default).toBe('true')
    expect(stepUsing(steps, 'actions/setup-node@')?.with).toEqual(expect.objectContaining({
      'node-version-file': '.nvmrc',
      cache: "${{ inputs.cache == 'true' && 'pnpm' || '' }}",
      'package-manager-cache': false,
    }))
  })

  it('lets pnpm/action-setup read the pnpm version from packageManager', () => {
    const pnpmSetup: Step | undefined = stepUsing(steps, 'pnpm/action-setup@')

    expect(pnpmSetup).toBeDefined()
    expect(pnpmSetup?.with?.version).toBeUndefined()
  })

  it('installs dependencies with a frozen lockfile', () => {
    expect(steps.at(-1)?.run).toBe('pnpm install --frozen-lockfile')
  })
})

describe('linux-electron-deps action', () => {
  const script: string = loadAction('linux-electron-deps').runs.steps
    .map((step: Step): string => step.run ?? '')
    .join('\n')

  it.each([
    'xvfb',
    'libnss3',
    'libatk1.0-0t64',
    'libatk-bridge2.0-0t64',
    'libcups2t64',
    'libdrm2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxrandr2',
    'libgbm1',
    'libasound2t64',
    'libpangocairo-1.0-0',
    'libpango-1.0-0',
    'libxtst6',
  ])('installs %s', (library: string) => {
    expect(script).toMatch(new RegExp(`\\s${library.replace(/[.+]/g, '\\$&')}(\\s|$)`))
  })
})

describe.each(workflowFiles)('%s reuses the composite actions', (file: string) => {
  const text: string = readFileSync(resolve(workflowsDir, file), 'utf8')

  it('never inlines pnpm/Node setup or apt-get installs', () => {
    expect(text).not.toMatch(/uses:\s*pnpm\/action-setup@/)
    expect(text).not.toMatch(/uses:\s*actions\/setup-node@/)
    expect(text).not.toContain('apt-get install')
  })

  it('checks out without persisted credentials before using a local action', () => {
    jobSteps(file).forEach((steps: Step[]): void => {
      const localIndex: number = steps.findIndex(
        (step: Step): boolean => step.uses === SETUP_WORKSPACE || step.uses === LINUX_ELECTRON_DEPS,
      )

      if (localIndex === -1) {
        return
      }

      const checkout: Step | undefined = stepUsing(steps.slice(0, localIndex), 'actions/checkout@')

      expect(checkout?.with?.['persist-credentials']).toBe(false)
    })
  })
})
