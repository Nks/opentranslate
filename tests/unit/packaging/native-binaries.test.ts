import {
  describe, expect, it,
} from 'vitest'
import {
  isForeignPlatformPackage,
  isForeignPrebuild,
  nativeBinaryExpectations,
  packageRootSegments,
} from '@scripts/packaging/native-binaries'
import {
  toNativeTarget,
  type NativeTarget,
} from '@scripts/packaging/targets'

const MAC_ARM64: NativeTarget = toNativeTarget({
  platform: 'mac',
  arch: 'arm64',
})
const MAC_X64: NativeTarget = toNativeTarget({
  platform: 'mac',
  arch: 'x64',
})
const WIN_X64: NativeTarget = toNativeTarget({
  platform: 'win',
  arch: 'x64',
})
const LINUX_X64: NativeTarget = toNativeTarget({
  platform: 'linux',
  arch: 'x64',
})

describe('nativeBinaryExpectations', () => {
  it.each([
    [MAC_ARM64, 'darwin-arm64'],
    [MAC_X64, 'darwin-x64'],
    [WIN_X64, 'win32-x64'],
    [LINUX_X64, 'linux-x64'],
  ])('requires better-sqlite3 and the %o uiohook prebuild (%s)', (target: NativeTarget, prebuild: string) => {
    expect(nativeBinaryExpectations(target)).toEqual([
      {
        label: 'better-sqlite3',
        segments: ['node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'],
      },
      {
        label: 'uiohook-napi prebuild',
        segments: ['node_modules', 'uiohook-napi', 'prebuilds', prebuild, 'uiohook-napi.node'],
      },
    ])
  })
})

describe('isForeignPrebuild', () => {
  it('ignores node-gyp-build prebuilds for other platforms', () => {
    const segments: string[] = ['node_modules', 'uiohook-napi', 'prebuilds', 'win32-x64', 'uiohook-napi.node']

    expect(isForeignPrebuild(segments, MAC_ARM64)).toBe(true)
  })

  it('keeps the prebuild matching the target', () => {
    const segments: string[] = ['node_modules', 'uiohook-napi', 'prebuilds', 'darwin-arm64', 'uiohook-napi.node']

    expect(isForeignPrebuild(segments, MAC_ARM64)).toBe(false)
  })

  it('keeps compiled build outputs, which node-gyp-build loads before prebuilds', () => {
    const segments: string[] = ['node_modules', 'uiohook-napi', 'build', 'Release', 'uiohook_napi.node']

    expect(isForeignPrebuild(segments, MAC_X64)).toBe(false)
  })
})

describe('packageRootSegments', () => {
  it('finds the innermost package of a nested binary', () => {
    const segments: string[] = ['node_modules', 'a', 'node_modules', 'b', 'build', 'b.node']

    expect(packageRootSegments(segments)).toEqual(['node_modules', 'a', 'node_modules', 'b'])
  })

  it('keeps the scope of a scoped package', () => {
    const segments: string[] = ['node_modules', '@parcel', 'watcher-darwin-arm64', 'watcher.node']

    expect(packageRootSegments(segments)).toEqual(['node_modules', '@parcel', 'watcher-darwin-arm64'])
  })

  it('returns null outside node_modules', () => {
    expect(packageRootSegments(['build', 'Release', 'addon.node'])).toBeNull()
  })
})

describe('isForeignPlatformPackage', () => {
  it('flags an optional platform package built for another cpu', () => {
    expect(isForeignPlatformPackage({
      os: ['darwin'],
      cpu: ['arm64'],
    }, MAC_X64)).toBe(true)
  })

  it('flags an optional platform package built for another os', () => {
    expect(isForeignPlatformPackage({
      os: ['linux'],
      cpu: ['x64'],
    }, WIN_X64)).toBe(true)
  })

  it('keeps the platform package that matches the target', () => {
    expect(isForeignPlatformPackage({
      os: ['darwin'],
      cpu: ['arm64'],
    }, MAC_ARM64)).toBe(false)
  })

  it('keeps packages that declare no os/cpu constraint', () => {
    expect(isForeignPlatformPackage({}, LINUX_X64)).toBe(false)
  })

  it('honours npm negations', () => {
    expect(isForeignPlatformPackage({
      cpu: ['!arm64'],
    }, MAC_ARM64)).toBe(true)
    expect(isForeignPlatformPackage({
      os: ['!win32'],
    }, LINUX_X64)).toBe(false)
  })
})
