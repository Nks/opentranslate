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

interface WorkspaceSettings {
  minimumReleaseAge?: number
  minimumReleaseAgeExclude?: string[]
}

interface PackageManifest {
  devDependencies: Record<string, string>
  pnpm?: {
    overrides?: Record<string, string>
  }
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const MINUTES_PER_DAY: number = 24 * 60
const DEPENDABOT_COOLDOWN_DAYS: number = 7
const SINGLE_MAJOR_RANGE: RegExp = /^[\^~]\d+\.\d+\.\d+$/

const workspace: WorkspaceSettings = yamlParse(
  readFileSync(resolve(rootDir, 'pnpm-workspace.yaml'), 'utf8'),
) as WorkspaceSettings
const manifest: PackageManifest = JSON.parse(
  readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
) as PackageManifest
const securityDoc: string = readFileSync(resolve(rootDir, 'docs', 'security.md'), 'utf8')

describe('dependency release age', () => {
  it('holds every dependency for the same 7 days as the Dependabot cooldown', () => {
    expect(workspace.minimumReleaseAge).toBe(DEPENDABOT_COOLDOWN_DAYS * MINUTES_PER_DAY)
  })

  it('exempts only the Electron security patch line', () => {
    expect(workspace.minimumReleaseAgeExclude).toEqual(['electron'])
  })

  it('pins Electron to one major so the exemption never pulls in a new major', () => {
    expect(manifest.devDependencies.electron).toMatch(SINGLE_MAJOR_RANGE)
    expect(manifest.devDependencies.electron?.startsWith('^')).toBe(true)
  })

  it('documents every exemption and override in docs/security.md', () => {
    const entries: string[] = [
      ...(workspace.minimumReleaseAgeExclude ?? []),
      ...Object.keys(manifest.pnpm?.overrides ?? {}),
    ]

    entries.forEach((entry: string): void => {
      expect(securityDoc).toContain(`\`${entry}\``)
    })
  })
})
