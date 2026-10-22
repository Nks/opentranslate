import {
  describe, expect, it,
} from 'vitest'
import {
  planPackageCommands,
} from '@scripts/packaging/package-plan'

const BUILD_STEPS: readonly string[] = ['pnpm run build:electron', 'pnpm run build:renderer']

describe('planPackageCommands', () => {
  it('builds once, then runs electron-builder per arch', () => {
    const commands: string[] = planPackageCommands({
      platform: 'mac',
      arches: ['x64', 'arm64'],
      dirOnly: false,
    })

    expect(commands).toEqual([
      ...BUILD_STEPS,
      'pnpm exec electron-builder --mac --x64 --publish never',
      'pnpm exec electron-builder --mac --arm64 --publish never',
    ])
  })

  it('never rebuilds native modules, because every target ships its own N-API prebuild', () => {
    const commands: string[] = planPackageCommands({
      platform: 'mac',
      arches: ['x64'],
      dirOnly: false,
    })

    expect(commands.some((command: string): boolean => command.includes('rebuild'))).toBe(false)
  })

  it('never lets electron-builder publish on its own', () => {
    const commands: string[] = planPackageCommands({
      platform: 'win',
      arches: ['x64'],
      dirOnly: false,
    })
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
    })

    expect(commands).toContain('pnpm exec electron-builder --linux --x64 --publish never --dir')
  })

  it('rejects an empty arch list', () => {
    expect(() => planPackageCommands({
      platform: 'mac',
      arches: [],
      dirOnly: false,
    })).toThrow(/at least one arch/)
  })
})
