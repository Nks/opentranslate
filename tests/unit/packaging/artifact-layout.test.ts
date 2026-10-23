import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync,
} from 'node:fs'
import {
  createRequire,
} from 'node:module'
import {
  join, resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'
import {
  appResourcesDir,
  artifactArchName,
  codeSignedBundlePath,
  installerFileNames,
  packagedExecutablePath,
  readBuilderLayout,
  resolveOutputDir,
  unpackedAppDirName,
  type AppIdentity,
  type BuilderLayout,
} from '@scripts/packaging/artifact-layout'
import type {
  PackageArch,
  PackageTarget,
} from '@scripts/packaging/targets'

interface BuilderUtilArchNaming {
  Arch: Record<PackageArch, number>
  getArtifactArchName: (arch: number, extension: string) => string
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const builderConfig: unknown = yamlParse(readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf8'))
const layout: BuilderLayout = readBuilderLayout(builderConfig)

const identity: AppIdentity = {
  packageName: 'opentranslate-desktop',
  productName: 'OpenTranslate Desktop',
  version: '0.1.0',
}

const MAC_ARM64: PackageTarget = {
  platform: 'mac',
  arch: 'arm64',
}
const MAC_X64: PackageTarget = {
  platform: 'mac',
  arch: 'x64',
}
const WIN_X64: PackageTarget = {
  platform: 'win',
  arch: 'x64',
}
const LINUX_X64: PackageTarget = {
  platform: 'linux',
  arch: 'x64',
}

describe('readBuilderLayout', () => {
  it('reads product name, output dir and artifact name patterns from electron-builder.yml', () => {
    expect(layout).toEqual({
      productName: 'OpenTranslate Desktop',
      outputDirPattern: 'release/${version}',
      artifactNamePattern: '${name}-${version}-${os}-${arch}.${ext}',
      nsisArtifactNamePattern: '${name}-${version}-${os}-${arch}-setup.${ext}',
    })
  })

  it('rejects a config without an artifact name pattern', () => {
    expect(() => readBuilderLayout({
      productName: 'X',
      directories: {
        output: 'release',
      },
    })).toThrow(/artifactName/)
  })
})

describe('resolveOutputDir', () => {
  it('expands ${version}', () => {
    expect(resolveOutputDir('release/${version}', '0.1.0')).toBe('release/0.1.0')
  })

  it('rejects macros it cannot expand', () => {
    expect(() => resolveOutputDir('release/${env.CHANNEL}', '0.1.0')).toThrow(/env\.CHANNEL/)
  })
})

describe('artifactArchName', () => {
  const requireFromRoot: NodeJS.Require = createRequire(resolve(rootDir, 'package.json'))
  const requireFromBuilder: NodeJS.Require = createRequire(
    requireFromRoot.resolve('electron-builder/package.json'),
  )
  const builderUtil: BuilderUtilArchNaming = requireFromBuilder('builder-util') as BuilderUtilArchNaming
  const cases: Array<[string, PackageArch]> = ['dmg', 'exe', 'zip', 'AppImage', 'deb']
    .flatMap((extension: string): Array<[string, PackageArch]> => [[extension, 'x64'], [extension, 'arm64']])

  it.each(cases)('mirrors the installed electron-builder for .%s %s', (extension: string, arch: PackageArch) => {
    expect(artifactArchName(arch, extension))
      .toBe(builderUtil.getArtifactArchName(builderUtil.Arch[arch], extension))
  })
})

describe('installerFileNames — collision-free release asset names', () => {
  it.each([
    [MAC_ARM64, ['opentranslate-desktop-0.1.0-mac-arm64.dmg']],
    [MAC_X64, ['opentranslate-desktop-0.1.0-mac-x64.dmg']],
    [WIN_X64, ['opentranslate-desktop-0.1.0-win-x64-setup.exe', 'opentranslate-desktop-0.1.0-win-x64.zip']],
    [LINUX_X64, ['opentranslate-desktop-0.1.0-linux-x86_64.AppImage', 'opentranslate-desktop-0.1.0-linux-amd64.deb']],
  ])('names %o artifacts %o', (target: PackageTarget, expected: string[]) => {
    expect(installerFileNames(target, identity, layout)).toEqual(expected)
  })

  it('produces a distinct name for every artifact across all release targets', () => {
    const names: string[] = [MAC_ARM64, MAC_X64, WIN_X64, LINUX_X64]
      .flatMap((target: PackageTarget): string[] => installerFileNames(target, identity, layout))

    expect(new Set(names).size).toBe(names.length)
  })

  it('rejects an unknown macro instead of emitting it verbatim', () => {
    const broken: BuilderLayout = {
      ...layout,
      artifactNamePattern: '${name}-${buildNumber}.${ext}',
    }

    expect(() => installerFileNames(MAC_X64, identity, broken)).toThrow(/buildNumber/)
  })
})

describe('unpacked app layout', () => {
  it.each([
    [MAC_ARM64, 'mac-arm64'],
    [MAC_X64, 'mac'],
    [WIN_X64, 'win-unpacked'],
    [LINUX_X64, 'linux-unpacked'],
  ])('names the %o unpacked dir %s', (target: PackageTarget, expected: string) => {
    expect(unpackedAppDirName(target)).toBe(expected)
  })

  it.each([
    [MAC_ARM64, join('out', 'mac-arm64', 'OpenTranslate Desktop.app')],
    [WIN_X64, null],
    [LINUX_X64, null],
  ])('names the code-signed bundle of %o', (target: PackageTarget, expected: string | null) => {
    expect(codeSignedBundlePath(target, identity, join('out', unpackedAppDirName(target)))).toBe(expected)
  })

  it('locates the mac executable and resources inside the .app bundle', () => {
    const appDir: string = join('out', 'mac-arm64')
    const bundle: string = join(appDir, 'OpenTranslate Desktop.app', 'Contents')

    expect(packagedExecutablePath(MAC_ARM64, identity, appDir))
      .toBe(join(bundle, 'MacOS', 'OpenTranslate Desktop'))
    expect(appResourcesDir(MAC_ARM64, identity, appDir)).toBe(join(bundle, 'Resources'))
  })

  it('locates the windows executable by product name', () => {
    const appDir: string = join('out', 'win-unpacked')

    expect(packagedExecutablePath(WIN_X64, identity, appDir))
      .toBe(join(appDir, 'OpenTranslate Desktop.exe'))
    expect(appResourcesDir(WIN_X64, identity, appDir)).toBe(join(appDir, 'resources'))
  })

  it('locates the linux executable by package name', () => {
    const appDir: string = join('out', 'linux-unpacked')

    expect(packagedExecutablePath(LINUX_X64, identity, appDir))
      .toBe(join(appDir, 'opentranslate-desktop'))
    expect(appResourcesDir(LINUX_X64, identity, appDir)).toBe(join(appDir, 'resources'))
  })
})
