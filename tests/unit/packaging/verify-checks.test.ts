import {
  describe, expect, it,
} from 'vitest'
import {
  join, sep,
} from 'node:path'
import {
  failedChecks,
  runPackageChecks,
  type CheckResult,
  type PackageLocations,
  type VerifyFileSystem,
} from '@scripts/packaging/verify-checks'
import type {
  PackageTarget,
} from '@scripts/packaging/targets'

const MACH_O_64_MAGIC: number = 0xfeedfacf
const CPU_TYPE_X86_64: number = 0x01000007
const CPU_TYPE_ARM64: number = 0x0100000c
const MAC_ARM64: PackageTarget = {
  platform: 'mac',
  arch: 'arm64',
}
const ROOT: string = join(sep, 'repo')
const RESOURCES: string = join(ROOT, 'release', 'mac-arm64', 'App.app', 'Contents', 'Resources')
const UNPACKED: string = join(RESOURCES, 'app.asar.unpacked')
const LOCATIONS: PackageLocations = {
  displayRoot: ROOT,
  installerPaths: [join(ROOT, 'release', 'app-mac-arm64.dmg')],
  executablePath: join(ROOT, 'release', 'mac-arm64', 'App.app', 'Contents', 'MacOS', 'App'),
  resourcesDir: RESOURCES,
}

type FakeFiles = Record<string, Uint8Array | string>

function thinMachO(cpuType: number): Uint8Array {
  const bytes: Uint8Array = new Uint8Array(32)
  const view: DataView = new DataView(bytes.buffer)

  view.setUint32(0, MACH_O_64_MAGIC, true)
  view.setInt32(4, cpuType, true)

  return bytes
}

function unpacked(...segments: string[]): string {
  return join(UNPACKED, ...segments)
}

function completeMacArm64Package(): FakeFiles {
  return {
    [LOCATIONS.installerPaths[0]!]: 'dmg',
    [LOCATIONS.executablePath]: thinMachO(CPU_TYPE_ARM64),
    [join(RESOURCES, 'app.asar')]: 'asar',
    [unpacked('node_modules', 'better-sqlite3', 'prebuilds', 'darwin-arm64.node')]: thinMachO(CPU_TYPE_ARM64),
    [unpacked('node_modules', 'uiohook-napi', 'prebuilds', 'darwin-arm64', 'uiohook-napi.node')]:
      thinMachO(CPU_TYPE_ARM64),
  }
}

function fakeFileSystem(files: FakeFiles): VerifyFileSystem {
  const paths: string[] = Object.keys(files)

  function contents(path: string): Uint8Array {
    const entry: Uint8Array | string | undefined = files[path]

    if (entry === undefined) {
      throw new Error(`ENOENT: ${path}`)
    }

    return typeof entry === 'string' ? new TextEncoder().encode(entry) : entry
  }

  return {
    exists: (path: string): boolean => paths.some(
      (candidate: string): boolean => candidate === path || candidate.startsWith(`${path}${sep}`),
    ),
    isNonEmptyFile: (path: string): boolean => path in files && contents(path).length > 0,
    readHeader: (path: string): Uint8Array => contents(path),
    readText: (path: string): string => new TextDecoder().decode(contents(path)),
    listFilesRecursive: (dir: string): string[] => paths
      .filter((path: string): boolean => path.startsWith(`${dir}${sep}`))
      .map((path: string): string => path.slice(dir.length + 1)),
  }
}

function check(files: FakeFiles): CheckResult[] {
  return runPackageChecks(MAC_ARM64, LOCATIONS, fakeFileSystem(files))
}

function messages(results: CheckResult[], status: CheckResult['status']): string[] {
  return results
    .filter((result: CheckResult): boolean => result.status === status)
    .map((result: CheckResult): string => result.message)
}

describe('runPackageChecks', () => {
  it('passes a complete package and reports every required artifact', () => {
    const results: CheckResult[] = check(completeMacArm64Package())

    expect(failedChecks(results)).toEqual([])
    expect(messages(results, 'pass')).toEqual([
      `installer: ${join('release', 'app-mac-arm64.dmg')}`,
      'executable: mach-o arm64',
      `app.asar: ${join('release', 'mac-arm64', 'App.app', 'Contents', 'Resources', 'app.asar')}`,
      'better-sqlite3 prebuild: mach-o arm64',
      'uiohook-napi prebuild: mach-o arm64',
    ])
  })

  it('fails when an installer is missing', () => {
    const files: FakeFiles = completeMacArm64Package()

    delete files[LOCATIONS.installerPaths[0]!]

    expect(messages(check(files), 'fail')).toEqual([`installer missing: ${LOCATIONS.installerPaths[0]}`])
  })

  it('fails when the main executable is built for another arch', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [LOCATIONS.executablePath]: thinMachO(CPU_TYPE_X86_64),
    })

    expect(messages(results, 'fail')).toEqual(['executable: expected mac arm64, found mach-o x64'])
  })

  it('fails when the target better-sqlite3 prebuild is missing', () => {
    const files: FakeFiles = completeMacArm64Package()
    const prebuild: string = unpacked('node_modules', 'better-sqlite3', 'prebuilds', 'darwin-arm64.node')

    delete files[prebuild]

    expect(messages(check(files), 'fail')).toEqual([`better-sqlite3 prebuild missing: ${prebuild}`])
  })

  it('fails when the target uiohook prebuild is built for another arch', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [unpacked('node_modules', 'uiohook-napi', 'prebuilds', 'darwin-arm64', 'uiohook-napi.node')]:
        thinMachO(CPU_TYPE_X86_64),
    })

    expect(messages(results, 'fail')).toEqual(['uiohook-napi prebuild: expected mac arm64, found mach-o x64'])
  })

  it('fails a binary whose header cannot be parsed', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [LOCATIONS.executablePath]: 'not a binary',
    })

    expect(messages(results, 'fail')).toEqual([
      expect.stringMatching(/^executable: Unrecognised binary header/),
    ])
  })

  it('never checks prebuilds for other platforms, in directory, file or combined layouts', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [unpacked('node_modules', 'better-sqlite3', 'prebuilds', 'linux-x64.node')]: 'elf',
      [unpacked('node_modules', 'uiohook-napi', 'prebuilds', 'win32-x64', 'uiohook-napi.node')]: 'pe',
      [unpacked('node_modules', 'other', 'prebuilds', 'linux-x64+arm64', 'other.node')]: 'elf',
    })

    expect(failedChecks(results)).toEqual([])
    expect(results.some((result: CheckResult): boolean => result.message.includes('linux'))).toBe(false)
    expect(results.some((result: CheckResult): boolean => result.message.includes('win32'))).toBe(false)
  })

  it('checks a combined-arch prebuild that includes the target arch', () => {
    const combined: string = unpacked('node_modules', 'other', 'prebuilds', 'darwin-x64+arm64', 'other.node')
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [combined]: thinMachO(CPU_TYPE_X86_64),
    })

    expect(messages(results, 'fail')).toEqual([
      'native node_modules/other/prebuilds/darwin-x64+arm64/other.node: expected mac arm64, found mach-o x64',
    ])
  })

  it('fails a host-compiled build output that does not match the target', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [unpacked('node_modules', 'uiohook-napi', 'build', 'Release', 'uiohook_napi.node')]: thinMachO(CPU_TYPE_X86_64),
    })

    expect(messages(results, 'fail')).toEqual([
      'native node_modules/uiohook-napi/build/Release/uiohook_napi.node: expected mac arm64, found mach-o x64',
    ])
  })

  it('skips binaries of npm platform packages whose os/cpu exclude the target', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [unpacked('node_modules', 'lightningcss-darwin-x64', 'package.json')]: JSON.stringify({
        os: ['darwin'],
        cpu: ['x64'],
      }),
      [unpacked('node_modules', 'lightningcss-darwin-x64', 'lightningcss.darwin-x64.node')]:
        thinMachO(CPU_TYPE_X86_64),
    })

    expect(failedChecks(results)).toEqual([])
    expect(messages(results, 'skip')).toEqual([
      'native node_modules/lightningcss-darwin-x64/lightningcss.darwin-x64.node: ' +
      'never loaded on mac-arm64 (package os=darwin cpu=x64)',
    ])
  })

  it('fails a platform package whose manifest is unreadable', () => {
    const results: CheckResult[] = check({
      ...completeMacArm64Package(),
      [unpacked('node_modules', 'broken', 'package.json')]: '{ not json',
      [unpacked('node_modules', 'broken', 'broken.node')]: thinMachO(CPU_TYPE_ARM64),
    })

    expect(messages(results, 'fail')).toEqual([
      expect.stringMatching(/^native node_modules\/broken\/broken\.node: /),
    ])
  })
})
