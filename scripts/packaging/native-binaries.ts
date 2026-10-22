import type {
  NativeTarget,
} from '@scripts/packaging/targets'

export interface NativeBinaryExpectation {
  label: string
  segments: readonly string[]
}

export interface PlatformManifest {
  os?: readonly string[]
  cpu?: readonly string[]
}

const NATIVE_EXTENSION: string = '.node'

function prebuildDirName(target: NativeTarget): string {
  return `${target.nodePlatform}-${target.arch}`
}

function allowsValue(constraint: readonly string[] | undefined, value: string): boolean {
  if (constraint === undefined || constraint.length === 0) {
    return true
  }

  if (constraint.includes(`!${value}`)) {
    return false
  }

  const allowed: string[] = constraint.filter((entry: string): boolean => !entry.startsWith('!'))
  const unrestricted: boolean = allowed.length === 0 || allowed.includes('any')

  return unrestricted || allowed.includes(value)
}

export function nativeBinaryExpectations(target: NativeTarget): NativeBinaryExpectation[] {
  return [
    {
      label: 'better-sqlite3 prebuild',
      segments: ['node_modules', 'better-sqlite3', 'prebuilds', `${prebuildDirName(target)}${NATIVE_EXTENSION}`],
    },
    {
      label: 'uiohook-napi prebuild',
      segments: ['node_modules', 'uiohook-napi', 'prebuilds', prebuildDirName(target), 'uiohook-napi.node'],
    },
  ]
}

export function isForeignPrebuild(segments: readonly string[], target: NativeTarget): boolean {
  const prebuildsIndex: number = segments.lastIndexOf('prebuilds')

  if (prebuildsIndex === -1) {
    return false
  }

  const platformArchEntry: string | undefined = segments[prebuildsIndex + 1]

  if (platformArchEntry === undefined) {
    return false
  }

  const platformArch: string = platformArchEntry.endsWith(NATIVE_EXTENSION)
    ? platformArchEntry.slice(0, -NATIVE_EXTENSION.length)
    : platformArchEntry

  return platformArch !== prebuildDirName(target)
}

export function packageRootSegments(segments: readonly string[]): string[] | null {
  const nodeModulesIndex: number = segments.lastIndexOf('node_modules')
  const firstName: string | undefined = segments[nodeModulesIndex + 1]

  if (nodeModulesIndex === -1 || firstName === undefined) {
    return null
  }

  const nameLength: number = firstName.startsWith('@') ? 2 : 1

  return segments.slice(0, nodeModulesIndex + 1 + nameLength)
}

export function isForeignPlatformPackage(
  manifest: PlatformManifest,
  target: NativeTarget,
): boolean {
  const osAllowed: boolean = allowsValue(manifest.os, target.nodePlatform)
  const cpuAllowed: boolean = allowsValue(manifest.cpu, target.arch)

  return !osAllowed || !cpuAllowed
}
