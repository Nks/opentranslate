import {
  join,
} from 'node:path'
import type {
  PackageArch,
  PackagePlatform,
  PackageTarget,
} from './targets.ts'

export interface AppIdentity {
  packageName: string
  productName: string
  version: string
}

export interface BuilderLayout {
  productName: string
  outputDirPattern: string
  artifactNamePattern: string
  nsisArtifactNamePattern: string
}

type InstallerKind = 'dmg' | 'nsis' | 'zip' | 'AppImage' | 'deb'

const INSTALLER_KINDS: Readonly<Record<PackagePlatform, readonly InstallerKind[]>> = {
  mac: ['dmg'],
  win: ['nsis', 'zip'],
  linux: ['AppImage', 'deb'],
}

const INSTALLER_EXTENSIONS: Readonly<Record<InstallerKind, string>> = {
  dmg: 'dmg',
  nsis: 'exe',
  zip: 'zip',
  AppImage: 'AppImage',
  deb: 'deb',
}

const LINUX_PACKAGE_ARCH_NAMES: Readonly<Record<string, Readonly<Record<PackageArch, string>>>> = {
  AppImage: {
    x64: 'x86_64',
    arm64: 'arm64',
  },
  deb: {
    x64: 'amd64',
    arm64: 'arm64',
  },
}

const MACRO_PATTERN: RegExp = /\$\{([^}]+)\}/g

function readString(
  source: Record<string, unknown> | undefined,
  key: string,
  path: string,
): string {
  const value: unknown = source?.[key]

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`electron-builder config is missing a string at ${path}`)
  }

  return value
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function expandMacros(pattern: string, macros: Readonly<Record<string, string>>): string {
  return pattern.replace(MACRO_PATTERN, (_match: string, macro: string): string => {
    const value: string | undefined = macros[macro]

    if (value === undefined) {
      throw new Error(`Unsupported electron-builder macro \${${macro}} in "${pattern}"`)
    }

    return value
  })
}

export function artifactArchName(arch: PackageArch, extension: string): string {
  return LINUX_PACKAGE_ARCH_NAMES[extension]?.[arch] ?? arch
}

export function readBuilderLayout(config: unknown): BuilderLayout {
  const root: Record<string, unknown> | undefined = asRecord(config)

  return {
    productName: readString(root, 'productName', 'productName'),
    outputDirPattern: readString(asRecord(root?.directories), 'output', 'directories.output'),
    artifactNamePattern: readString(root, 'artifactName', 'artifactName'),
    nsisArtifactNamePattern: readString(asRecord(root?.nsis), 'artifactName', 'nsis.artifactName'),
  }
}

export function resolveOutputDir(pattern: string, version: string): string {
  return expandMacros(pattern, {
    version,
  })
}

export function installerFileNames(
  target: PackageTarget,
  identity: AppIdentity,
  layout: BuilderLayout,
): string[] {
  return INSTALLER_KINDS[target.platform].map((kind: InstallerKind): string => {
    const extension: string = INSTALLER_EXTENSIONS[kind]
    const pattern: string = kind === 'nsis' ? layout.nsisArtifactNamePattern : layout.artifactNamePattern

    return expandMacros(pattern, {
      name: identity.packageName,
      productName: identity.productName,
      version: identity.version,
      os: target.platform,
      arch: artifactArchName(target.arch, extension),
      ext: extension,
    })
  })
}

export function unpackedAppDirName(target: PackageTarget): string {
  const archSuffix: string = target.arch === 'x64' ? '' : `-${target.arch}`
  const unpackedSuffix: string = target.platform === 'mac' ? '' : '-unpacked'

  return `${target.platform}${archSuffix}${unpackedSuffix}`
}

export function appResourcesDir(
  target: PackageTarget,
  identity: AppIdentity,
  unpackedDir: string,
): string {
  if (target.platform === 'mac') {
    return join(unpackedDir, `${identity.productName}.app`, 'Contents', 'Resources')
  }

  return join(unpackedDir, 'resources')
}

export function packagedExecutablePath(
  target: PackageTarget,
  identity: AppIdentity,
  unpackedDir: string,
): string {
  if (target.platform === 'mac') {
    return join(unpackedDir, `${identity.productName}.app`, 'Contents', 'MacOS', identity.productName)
  }

  if (target.platform === 'win') {
    return join(unpackedDir, `${identity.productName}.exe`)
  }

  return join(unpackedDir, identity.packageName)
}
