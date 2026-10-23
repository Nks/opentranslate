import {
  join, relative, sep,
} from 'node:path'
import {
  toNativeTarget,
  type NativeTarget,
  type PackageTarget,
} from './targets.ts'
import {
  assessBinaryTarget,
  detectBinaryArch,
  type ArchAssessment,
} from './binary-arch.ts'
import type {
  CodeSignatureResult,
  CodeSignatureVerifier,
} from './code-signature.ts'
import {
  isForeignPlatformPackage,
  isForeignPrebuild,
  nativeBinaryExpectations,
  packageRootSegments,
  type NativeBinaryExpectation,
  type PlatformManifest,
} from './native-binaries.ts'

export type CheckStatus = 'pass' | 'fail' | 'skip'

export interface CheckResult {
  status: CheckStatus
  message: string
}

/** Read-only file access, injected so the checks run against a fake tree in tests. */
export interface VerifyFileSystem {
  exists: (path: string) => boolean
  isNonEmptyFile: (path: string) => boolean
  readHeader: (path: string) => Uint8Array
  readText: (path: string) => string
  listFilesRecursive: (dir: string) => string[]
}

export interface PackageLocations {
  displayRoot: string
  installerPaths: readonly string[]
  executablePath: string
  resourcesDir: string
  codeSignedBundlePath: string | null
}

export interface VerifyEnvironment {
  fileSystem: VerifyFileSystem
  verifyCodeSignature: CodeSignatureVerifier
}

interface CheckScope {
  target: PackageTarget
  nativeTarget: NativeTarget
  locations: PackageLocations
  fileSystem: VerifyFileSystem
  unpackedRoot: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function checkFile(scope: CheckScope, label: string, path: string): CheckResult {
  if (!scope.fileSystem.isNonEmptyFile(path)) {
    return {
      status: 'fail',
      message: `${label} missing: ${path}`,
    }
  }

  return {
    status: 'pass',
    message: `${label}: ${relative(scope.locations.displayRoot, path)}`,
  }
}

function checkBinary(scope: CheckScope, label: string, path: string): CheckResult {
  if (!scope.fileSystem.exists(path)) {
    return {
      status: 'fail',
      message: `${label} missing: ${path}`,
    }
  }

  try {
    const assessment: ArchAssessment = assessBinaryTarget(
      detectBinaryArch(scope.fileSystem.readHeader(path)),
      scope.target,
    )

    return {
      status: assessment.matches ? 'pass' : 'fail',
      message: `${label}: ${assessment.detail}`,
    }
  } catch (err: unknown) {
    return {
      status: 'fail',
      message: `${label}: ${errorMessage(err)}`,
    }
  }
}

function checkCodeSignature(bundlePath: string, verify: CodeSignatureVerifier): CheckResult {
  const result: CodeSignatureResult = verify(bundlePath)

  return {
    status: result.valid ? 'pass' : 'fail',
    message: `code signature: ${result.detail}`,
  }
}

function readPlatformManifest(scope: CheckScope, packageRoot: readonly string[]): PlatformManifest {
  const manifestPath: string = join(scope.unpackedRoot, ...packageRoot, 'package.json')

  if (!scope.fileSystem.exists(manifestPath)) {
    return {}
  }

  const manifest: PlatformManifest = JSON.parse(
    scope.fileSystem.readText(manifestPath),
  ) as PlatformManifest

  return {
    ...(manifest.os === undefined ? {} : { os: manifest.os }),
    ...(manifest.cpu === undefined ? {} : { cpu: manifest.cpu }),
  }
}

function checkExtraBinary(scope: CheckScope, segments: readonly string[]): CheckResult {
  const label: string = `native ${segments.join('/')}`
  const packageRoot: string[] | null = packageRootSegments(segments)

  try {
    const manifest: PlatformManifest = packageRoot === null
      ? {}
      : readPlatformManifest(scope, packageRoot)

    if (isForeignPlatformPackage(manifest, scope.nativeTarget)) {
      const constraint: string = `os=${manifest.os?.join(',') ?? 'any'} cpu=${manifest.cpu?.join(',') ?? 'any'}`

      return {
        status: 'skip',
        message: `${label}: never loaded on ${scope.target.platform}-${scope.target.arch} (package ${constraint})`,
      }
    }
  } catch (err: unknown) {
    return {
      status: 'fail',
      message: `${label}: ${errorMessage(err)}`,
    }
  }

  return checkBinary(scope, label, join(scope.unpackedRoot, ...segments))
}

function loadableExtraBinaries(
  scope: CheckScope,
  required: readonly NativeBinaryExpectation[],
): string[][] {
  if (!scope.fileSystem.exists(scope.unpackedRoot)) {
    return []
  }

  const requiredPaths: Set<string> = new Set<string>(
    required.map((expectation: NativeBinaryExpectation): string => expectation.segments.join(sep)),
  )

  return scope.fileSystem.listFilesRecursive(scope.unpackedRoot)
    .filter((entry: string): boolean => entry.endsWith('.node') && !requiredPaths.has(entry))
    .map((entry: string): string[] => entry.split(sep))
    .filter((segments: string[]): boolean => !isForeignPrebuild(segments, scope.nativeTarget))
}

/**
 * Checks one packaged target: installers, the executable's arch, the mac
 * bundle's code-signature seal, app.asar, the required per-target native
 * prebuilds and every other loadable `.node`.
 */
export function runPackageChecks(
  target: PackageTarget,
  locations: PackageLocations,
  environment: VerifyEnvironment,
): CheckResult[] {
  const scope: CheckScope = {
    target,
    nativeTarget: toNativeTarget(target),
    locations,
    fileSystem: environment.fileSystem,
    unpackedRoot: join(locations.resourcesDir, 'app.asar.unpacked'),
  }
  const required: NativeBinaryExpectation[] = nativeBinaryExpectations(scope.nativeTarget)
  const signatureChecks: CheckResult[] = locations.codeSignedBundlePath === null
    ? []
    : [checkCodeSignature(locations.codeSignedBundlePath, environment.verifyCodeSignature)]

  return [
    ...locations.installerPaths.map((path: string): CheckResult => checkFile(scope, 'installer', path)),
    checkBinary(scope, 'executable', locations.executablePath),
    ...signatureChecks,
    checkFile(scope, 'app.asar', join(locations.resourcesDir, 'app.asar')),
    ...required.map((expectation: NativeBinaryExpectation): CheckResult =>
      checkBinary(scope, expectation.label, join(scope.unpackedRoot, ...expectation.segments))),
    ...loadableExtraBinaries(scope, required).map((segments: string[]): CheckResult =>
      checkExtraBinary(scope, segments)),
  ]
}

export function failedChecks(results: readonly CheckResult[]): CheckResult[] {
  return results.filter((result: CheckResult): boolean => result.status === 'fail')
}
