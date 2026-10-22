import {
  describe, expect, it,
} from 'vitest'
import {
  SUPPORTED_TARGETS,
  hostPackagePlatform,
  parsePackageCliArgs,
  parseVerifyCliArgs,
  toNativeTarget,
  type PackageRequest,
  type VerifyRequest,
} from '@scripts/packaging/targets'

describe('SUPPORTED_TARGETS', () => {
  it('lists exactly the four release targets', () => {
    expect(SUPPORTED_TARGETS).toEqual([
      {
        platform: 'mac',
        arch: 'arm64',
      },
      {
        platform: 'mac',
        arch: 'x64',
      },
      {
        platform: 'win',
        arch: 'x64',
      },
      {
        platform: 'linux',
        arch: 'x64',
      },
    ])
  })
})

describe('hostPackagePlatform', () => {
  it.each([
    ['darwin', 'mac'],
    ['win32', 'win'],
    ['linux', 'linux'],
  ] as const)('maps %s to %s', (nodePlatform: NodeJS.Platform, expected: string) => {
    expect(hostPackagePlatform(nodePlatform)).toBe(expected)
  })

  it('rejects hosts electron-builder targets are not configured for', () => {
    expect(() => hostPackagePlatform('freebsd')).toThrow(/Unsupported host platform: freebsd/)
  })
})

describe('toNativeTarget', () => {
  it.each([
    ['mac', 'darwin'],
    ['win', 'win32'],
    ['linux', 'linux'],
  ] as const)('maps %s to node platform %s and keeps the arch', (platform: 'mac' | 'win' | 'linux', nodePlatform: string) => {
    expect(toNativeTarget({
      platform,
      arch: 'x64',
    })).toEqual({
      nodePlatform,
      arch: 'x64',
    })
  })
})

describe('parsePackageCliArgs', () => {
  it('defaults macOS to x64 then arm64', () => {
    const request: PackageRequest = parsePackageCliArgs([], 'darwin')

    expect(request).toEqual({
      platform: 'mac',
      arches: ['x64', 'arm64'],
      dirOnly: false,
    })
  })

  it.each(['win32', 'linux'] as const)('defaults %s to x64 only', (nodePlatform: NodeJS.Platform) => {
    expect(parsePackageCliArgs([], nodePlatform).arches).toEqual(['x64'])
  })

  it('accepts --arch=<arch> to build a single architecture', () => {
    expect(parsePackageCliArgs(['--arch=arm64'], 'darwin').arches).toEqual(['arm64'])
  })

  it('accepts --arch <arch> with a separate value', () => {
    expect(parsePackageCliArgs(['--arch', 'x64'], 'darwin').arches).toEqual(['x64'])
  })

  it('tolerates the `--` separator from `pnpm run package -- --arch=x64`', () => {
    expect(parsePackageCliArgs(['--', '--arch=x64'], 'darwin').arches).toEqual(['x64'])
  })

  it('keeps --dir for unpacked output', () => {
    expect(parsePackageCliArgs(['--dir', '--arch=x64'], 'linux').dirOnly).toBe(true)
  })

  it('rejects an arch outside x64/arm64', () => {
    expect(() => parsePackageCliArgs(['--arch=ia32'], 'win32')).toThrow(/Unknown arch "ia32"/)
  })

  it('rejects a platform-arch pair that is not a release target', () => {
    expect(() => parsePackageCliArgs(['--arch=arm64'], 'linux')).toThrow(/Unsupported target linux-arm64/)
  })

  it('rejects unknown flags instead of ignoring them', () => {
    expect(() => parsePackageCliArgs(['--publish=always'], 'darwin')).toThrow()
  })
})

describe('parseVerifyCliArgs', () => {
  it('parses platform and arch', () => {
    const request: VerifyRequest = parseVerifyCliArgs(['--platform', 'mac', '--arch', 'arm64'])

    expect(request).toEqual({
      target: {
        platform: 'mac',
        arch: 'arm64',
      },
      print: null,
    })
  })

  it.each(['executable', 'installers'] as const)('supports --print %s', (mode: string) => {
    const argv: string[] = ['--platform=linux', '--arch=x64', '--print', mode]

    expect(parseVerifyCliArgs(argv).print).toBe(mode)
  })

  it('rejects an unknown --print mode', () => {
    expect(() => parseVerifyCliArgs(['--platform=mac', '--arch=x64', '--print=everything']))
      .toThrow(/Unknown --print "everything"/)
  })

  it('tolerates the `--` separator from `pnpm run verify:package -- ...`', () => {
    expect(parseVerifyCliArgs(['--', '--platform=win', '--arch=x64']).target).toEqual({
      platform: 'win',
      arch: 'x64',
    })
  })

  it('requires both --platform and --arch', () => {
    expect(() => parseVerifyCliArgs(['--platform', 'mac'])).toThrow(/Usage: verify-package/)
    expect(() => parseVerifyCliArgs(['--arch', 'x64'])).toThrow(/Usage: verify-package/)
  })

  it('rejects an unknown platform', () => {
    expect(() => parseVerifyCliArgs(['--platform', 'darwin', '--arch', 'x64']))
      .toThrow(/Unknown platform "darwin"/)
  })

  it('rejects an unsupported target', () => {
    expect(() => parseVerifyCliArgs(['--platform', 'win', '--arch', 'arm64']))
      .toThrow(/Unsupported target win-arm64/)
  })
})
