import {
  describe, expect, it,
} from 'vitest'
import {
  planPackageCommands,
} from '@scripts/packaging/package-plan'

const BUILD_STEPS: readonly string[] = ['pnpm run build:electron', 'pnpm run build:renderer']

function rebuild(arch: string): string {
  return `pnpm exec electron-rebuild -f -o better-sqlite3 --arch=${arch}`
}

describe('planPackageCommands', () => {
  it('builds both mac arches with a per-arch native rebuild before each builder run', () => {
    const commands: string[] = planPackageCommands({
      platform: 'mac',
      arches: ['x64', 'arm64'],
      dirOnly: false,
    }, 'arm64')

    expect(commands).toEqual([
      ...BUILD_STEPS,
      rebuild('x64'),
      'pnpm exec electron-builder --mac --x64 --publish never',
      rebuild('arm64'),
      'pnpm exec electron-builder --mac --arm64 --publish never',
    ])
  })

  it('never lets electron-builder publish on its own', () => {
    const commands: string[] = planPackageCommands({
      platform: 'win',
      arches: ['x64'],
      dirOnly: false,
    }, 'x64')
    const builderCommands: string[] = commands.filter(
      (command: string): boolean => command.includes('electron-builder'),
    )

    expect(builderCommands).toHaveLength(1)
    expect(builderCommands.every((command: string): boolean => command.includes('--publish never')))
      .toBe(true)
  })

  it('appends --dir for unpacked output', () => {
    const commands: string[] = planPackageCommands({
      platform: 'linux',
      arches: ['x64'],
      dirOnly: true,
    }, 'x64')

    expect(commands).toContain('pnpm exec electron-builder --linux --x64 --publish never --dir')
  })

  it('restores the host-arch native binary after cross-arch packaging', () => {
    const commands: string[] = planPackageCommands({
      platform: 'mac',
      arches: ['x64'],
      dirOnly: false,
    }, 'arm64')

    expect(commands.at(-1)).toBe(rebuild('arm64'))
  })

  it('skips the restore step when the last packaged arch is the host arch', () => {
    const commands: string[] = planPackageCommands({
      platform: 'linux',
      arches: ['x64'],
      dirOnly: false,
    }, 'x64')

    expect(commands.at(-1)).toBe('pnpm exec electron-builder --linux --x64 --publish never')
  })

  it('rejects an empty arch list', () => {
    expect(() => planPackageCommands({
      platform: 'mac',
      arches: [],
      dirOnly: false,
    }, 'arm64')).toThrow(/at least one arch/)
  })
})
