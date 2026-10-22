import {
  parseArgs,
} from 'node:util'

export type PackagePlatform = 'mac' | 'win' | 'linux'
export type PackageArch = 'x64' | 'arm64'

export interface PackageTarget {
  platform: PackagePlatform
  arch: PackageArch
}

export interface PackageRequest {
  platform: PackagePlatform
  arches: readonly PackageArch[]
  dirOnly: boolean
}

export interface NativeTarget {
  nodePlatform: NodeJS.Platform
  arch: PackageArch
}

export type VerifyPrintMode = 'executable' | 'installers'

export interface VerifyRequest {
  target: PackageTarget
  print: VerifyPrintMode | null
}

const PACKAGE_PLATFORMS: readonly PackagePlatform[] = ['mac', 'win', 'linux']
const PACKAGE_ARCHES: readonly PackageArch[] = ['x64', 'arm64']
const VERIFY_PRINT_MODES: readonly VerifyPrintMode[] = ['executable', 'installers']

const NODE_PLATFORMS: Readonly<Record<PackagePlatform, NodeJS.Platform>> = {
  mac: 'darwin',
  win: 'win32',
  linux: 'linux',
}

const DEFAULT_ARCHES: Readonly<Record<PackagePlatform, readonly PackageArch[]>> = {
  mac: ['x64', 'arm64'],
  win: ['x64'],
  linux: ['x64'],
}

export const SUPPORTED_TARGETS: readonly PackageTarget[] = [
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
]

function parseChoice<Choice extends string>(
  value: string,
  choices: readonly Choice[],
  label: string,
): Choice {
  const match: Choice | undefined = choices.find((choice: Choice): boolean => choice === value)

  if (match === undefined) {
    throw new Error(`Unknown ${label} "${value}". Expected one of: ${choices.join(', ')}`)
  }

  return match
}

function withoutOptionTerminator(argv: readonly string[]): string[] {
  return argv.filter((arg: string): boolean => arg !== '--')
}

export function parsePackagePlatform(value: string): PackagePlatform {
  return parseChoice(value, PACKAGE_PLATFORMS, 'platform')
}

export function parsePackageArch(value: string): PackageArch {
  return parseChoice(value, PACKAGE_ARCHES, 'arch')
}

function parseVerifyPrintMode(value: string | undefined): VerifyPrintMode | null {
  return value === undefined ? null : parseChoice(value, VERIFY_PRINT_MODES, '--print')
}

export function hostPackagePlatform(nodePlatform: NodeJS.Platform): PackagePlatform {
  const platform: PackagePlatform | undefined = PACKAGE_PLATFORMS.find(
    (candidate: PackagePlatform): boolean => NODE_PLATFORMS[candidate] === nodePlatform,
  )

  if (!platform) {
    throw new Error(`Unsupported host platform: ${nodePlatform}`)
  }

  return platform
}

export function toNativeTarget(target: PackageTarget): NativeTarget {
  return {
    nodePlatform: NODE_PLATFORMS[target.platform],
    arch: target.arch,
  }
}

export function assertSupportedTarget(target: PackageTarget): PackageTarget {
  const supported: boolean = SUPPORTED_TARGETS.some(
    (candidate: PackageTarget): boolean =>
      candidate.platform === target.platform && candidate.arch === target.arch,
  )

  if (!supported) {
    const list: string = SUPPORTED_TARGETS
      .map((candidate: PackageTarget): string => `${candidate.platform}-${candidate.arch}`)
      .join(', ')

    throw new Error(`Unsupported target ${target.platform}-${target.arch}. Supported: ${list}`)
  }

  return target
}

export function parsePackageCliArgs(
  argv: readonly string[],
  nodePlatform: NodeJS.Platform,
): PackageRequest {
  const { values } = parseArgs({
    args: withoutOptionTerminator(argv),
    options: {
      arch: {
        type: 'string',
      },
      dir: {
        type: 'boolean',
        default: false,
      },
    },
    strict: true,
    allowPositionals: false,
  })
  const platform: PackagePlatform = hostPackagePlatform(nodePlatform)
  const arches: readonly PackageArch[] = values.arch === undefined
    ? DEFAULT_ARCHES[platform]
    : [parsePackageArch(values.arch)]

  arches.forEach((arch: PackageArch): void => {
    assertSupportedTarget({
      platform,
      arch,
    })
  })

  return {
    platform,
    arches,
    dirOnly: values.dir,
  }
}

export function parseVerifyCliArgs(argv: readonly string[]): VerifyRequest {
  const { values } = parseArgs({
    args: withoutOptionTerminator(argv),
    options: {
      platform: {
        type: 'string',
      },
      arch: {
        type: 'string',
      },
      print: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: false,
  })

  if (values.platform === undefined || values.arch === undefined) {
    throw new Error(
      'Usage: verify-package --platform <mac|win|linux> --arch <x64|arm64> [--print <executable|installers>]',
    )
  }

  return {
    target: assertSupportedTarget({
      platform: parsePackagePlatform(values.platform),
      arch: parsePackageArch(values.arch),
    }),
    print: parseVerifyPrintMode(values.print),
  }
}
