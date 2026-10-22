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
  installerFileNames,
  readBuilderLayout,
  type AppIdentity,
  type BuilderLayout,
} from '@scripts/packaging/artifact-layout'
import {
  SUPPORTED_TARGETS,
  type PackageTarget,
} from '@scripts/packaging/targets'

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
}

interface WorkflowJob {
  needs?: string | string[]
  uses?: string
  with?: Record<string, unknown>
  permissions?: Record<string, string>
  steps?: WorkflowStep[]
}

interface Workflow {
  on: {
    push?: {
      tags?: string[]
    }
  }
  permissions?: Record<string, string>
  jobs: Record<string, WorkflowJob>
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const workflow: Workflow = yamlParse(
  readFileSync(resolve(rootDir, '.github', 'workflows', 'release.yml'), 'utf8'),
) as Workflow
const INSTALLER_SUFFIXES: readonly string[] = ['.dmg', '.exe', '.zip', '.AppImage', '.deb']

function job(name: string): WorkflowJob {
  const found: WorkflowJob | undefined = workflow.jobs[name]

  if (!found) {
    throw new Error(`release.yml has no job "${name}"`)
  }

  return found
}

function publishStep(name: string): WorkflowStep {
  const found: WorkflowStep | undefined = job('publish').steps
    ?.find((step: WorkflowStep): boolean => step.name === name)

  if (!found) {
    throw new Error(`publish job has no step "${name}"`)
  }

  return found
}

function publishStepIndex(name: string): number {
  return (job('publish').steps ?? []).findIndex((step: WorkflowStep): boolean => step.name === name)
}

describe('release.yml triggers and permissions', () => {
  it('triggers on version tags', () => {
    expect(workflow.on.push?.tags).toEqual(['v*'])
  })

  it('keeps the token read-only by default and elevates only the publish job', () => {
    expect(workflow.permissions).toEqual({
      contents: 'read',
    })
    expect(job('publish').permissions).toEqual({
      contents: 'write',
      'id-token': 'write',
      attestations: 'write',
    })
    Object.entries(workflow.jobs)
      .filter(([name]: [string, WorkflowJob]): boolean => name !== 'publish')
      .forEach(([, other]: [string, WorkflowJob]): void => {
        expect(other.permissions).toBeUndefined()
      })
  })
})

describe('release.yml pipeline', () => {
  it('fails fast when the tag does not match package.json', () => {
    const guard: WorkflowStep | undefined = job('version-guard').steps
      ?.find((step: WorkflowStep): boolean => step.run?.includes('package.json') === true)

    expect(guard?.env?.TAG_NAME).toBe('${{ github.ref_name }}')
    expect(guard?.run).toContain('jq -r .version package.json')
    expect(guard?.run).toContain('exit 1')
  })

  it('runs the shared checks after the version guard', () => {
    expect(job('checks').needs).toBe('version-guard')
    expect(job('checks').uses).toBe('./.github/workflows/checks.yml')
  })

  it('packages via the reusable workflow after checks, without the dependency cache', () => {
    expect(job('package').needs).toBe('checks')
    expect(job('package').uses).toBe('./.github/workflows/package.yml')
    expect(job('package').with?.['cache-dependencies']).toBe(false)
  })

  it('publishes only after every package job succeeded', () => {
    expect(job('publish').needs).toBe('package')
  })
})

describe('release.yml publish job', () => {
  it('downloads every package-<platform>-<arch> artifact into one folder', () => {
    const download: WorkflowStep = publishStep('Download installers')

    expect(download.uses).toMatch(/^actions\/download-artifact@/)
    expect(download.with).toEqual({
      pattern: 'package-*',
      path: 'release-assets',
      'merge-multiple': true,
    })
  })

  it('expects exactly the installers produced by the supported targets', () => {
    const builderConfig: unknown = yamlParse(readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf8'))
    const layout: BuilderLayout = readBuilderLayout(builderConfig)
    const identity: AppIdentity = {
      packageName: 'opentranslate-desktop',
      productName: layout.productName,
      version: '0.1.0',
    }
    const installerCount: number = SUPPORTED_TARGETS
      .flatMap((target: PackageTarget): string[] => installerFileNames(target, identity, layout))
      .length

    expect(publishStep('Check installer set and write SHA256SUMS.txt').env?.EXPECTED_INSTALLERS)
      .toBe(installerCount)
  })

  it('writes SHA256SUMS.txt before creating the release', () => {
    const checksum: WorkflowStep = publishStep('Check installer set and write SHA256SUMS.txt')

    expect(checksum.run).toContain('sha256sum -- "${installers[@]}" > SHA256SUMS.txt')
    expect(publishStepIndex('Check installer set and write SHA256SUMS.txt'))
      .toBeLessThan(publishStepIndex('Create draft GitHub pre-release'))
  })

  it('creates a draft pre-release with generated notes', () => {
    const release: WorkflowStep = publishStep('Create draft GitHub pre-release')

    expect(release.uses).toMatch(/^softprops\/action-gh-release@/)
    expect(release.with?.draft).toBe(true)
    expect(release.with?.prerelease).toBe(true)
    expect(release.with?.generate_release_notes).toBe(true)
    expect(release.with?.fail_on_unmatched_files).toBe(true)
  })

  it('attaches only installers and checksums — no update metadata or blockmaps', () => {
    const files: string[] = String(publishStep('Create draft GitHub pre-release').with?.files)
      .split('\n')
      .map((line: string): string => line.trim())
      .filter((line: string): boolean => line.length > 0)

    expect(files).toContain('release-assets/SHA256SUMS.txt')
    files
      .filter((file: string): boolean => file !== 'release-assets/SHA256SUMS.txt')
      .forEach((file: string): void => {
        const isInstaller: boolean = INSTALLER_SUFFIXES.some(
          (suffix: string): boolean => file.endsWith(suffix),
        )

        expect(isInstaller).toBe(true)
      })
  })

  it('refuses to touch a release that is already published, reading the tag from env', () => {
    const guard: WorkflowStep = publishStep('Refuse to modify a published release')

    expect(guard.env?.TAG_NAME).toBe('${{ github.ref_name }}')
    expect(guard.env?.GH_REPO).toBe('${{ github.repository }}')
    expect(guard.run).toContain('gh release view "${TAG_NAME}" --json isDraft')
    expect(guard.run).toContain('exit 1')
    expect(guard.run).not.toContain('${{')
    expect(publishStepIndex('Refuse to modify a published release'))
      .toBeLessThan(publishStepIndex('Create draft GitHub pre-release'))
  })

  it('attests build provenance for every installer and the checksum file', () => {
    const attest: WorkflowStep = publishStep('Attest build provenance')
    const subjects: string[] = String(attest.with?.['subject-path'])
      .split('\n')
      .map((line: string): string => line.trim())
      .filter((line: string): boolean => line.length > 0)
    const released: string[] = String(publishStep('Create draft GitHub pre-release').with?.files)
      .split('\n')
      .map((line: string): string => line.trim())
      .filter((line: string): boolean => line.length > 0)

    expect(attest.uses).toMatch(/^actions\/attest-build-provenance@[0-9a-f]{40}$/)
    expect(subjects).toEqual(released)
    expect(publishStepIndex('Check installer set and write SHA256SUMS.txt'))
      .toBeLessThan(publishStepIndex('Attest build provenance'))
  })
})
