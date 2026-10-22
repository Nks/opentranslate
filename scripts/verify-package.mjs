/**
 * Verifies electron-builder output for one release target.
 *
 * Asserts installers exist under their collision-free names, the unpacked app
 * and executable exist, and every loadable native binary in app.asar.unpacked
 * (better-sqlite3, uiohook-napi prebuild, any compiled build output) matches
 * the target platform + arch by its Mach-O / PE / ELF header. Prebuilds and
 * npm platform packages (os/cpu) for other targets are never loaded, so they
 * are reported as skipped instead of checked.
 *
 * Usage:
 *   node scripts/verify-package.mjs --platform mac --arch arm64
 *   node scripts/verify-package.mjs --platform linux --arch x64 --print executable
 *   node scripts/verify-package.mjs --platform win --arch x64 --print installers
 */
import {
  closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync,
} from 'node:fs'
import {
  dirname, join, relative, resolve, sep,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'
import {
  parse as parseYaml,
} from 'yaml'
import {
  parseVerifyCliArgs, toNativeTarget,
} from './packaging/targets.ts'
import {
  BINARY_HEADER_BYTES, assessBinaryTarget, detectBinaryArch,
} from './packaging/binary-arch.ts'
import {
  appResourcesDir,
  installerFileNames,
  packagedExecutablePath,
  readBuilderLayout,
  resolveOutputDir,
  unpackedAppDirName,
} from './packaging/artifact-layout.ts'
import {
  isForeignPlatformPackage,
  isForeignPrebuild,
  nativeBinaryExpectations,
  packageRootSegments,
} from './packaging/native-binaries.ts'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATUS_MARKS = {
  pass: '✓',
  fail: '✗',
  skip: '–',
}

function loadContext(target) {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const layout = readBuilderLayout(parseYaml(readFileSync(join(rootDir, 'electron-builder.yml'), 'utf8')))
  const identity = {
    packageName: pkg.name,
    productName: layout.productName,
    version: pkg.version,
  }
  const releaseDir = resolve(rootDir, resolveOutputDir(layout.outputDirPattern, pkg.version))
  const unpackedDir = join(releaseDir, unpackedAppDirName(target))

  return {
    identity,
    installerPaths: installerFileNames(target, identity, layout)
      .map((name) => join(releaseDir, name)),
    executablePath: packagedExecutablePath(target, identity, unpackedDir),
    resourcesDir: appResourcesDir(target, identity, unpackedDir),
  }
}

function readHeader(filePath) {
  const descriptor = openSync(filePath, 'r')

  try {
    const buffer = Buffer.alloc(BINARY_HEADER_BYTES)
    const bytesRead = readSync(descriptor, buffer, 0, BINARY_HEADER_BYTES, 0)

    return buffer.subarray(0, bytesRead)
  } finally {
    closeSync(descriptor)
  }
}

function checkFile(label, filePath) {
  const present = existsSync(filePath) && statSync(filePath).size > 0

  return {
    status: present ? 'pass' : 'fail',
    message: present ? `${label}: ${relative(rootDir, filePath)}` : `${label} missing: ${filePath}`,
  }
}

function checkNativeBinary(label, filePath, target) {
  if (!existsSync(filePath)) {
    return {
      status: 'fail',
      message: `${label} missing: ${filePath}`,
    }
  }

  try {
    const assessment = assessBinaryTarget(detectBinaryArch(readHeader(filePath)), target)

    return {
      status: assessment.matches ? 'pass' : 'fail',
      message: `${label}: ${assessment.detail}`,
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function readPlatformManifest(unpackedRoot, packageRoot) {
  const manifestPath = join(unpackedRoot, ...packageRoot, 'package.json')

  if (!existsSync(manifestPath)) {
    return {}
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  return {
    os: manifest.os,
    cpu: manifest.cpu,
  }
}

function checkExtraNativeBinary(segments, unpackedRoot, target, nativeTarget) {
  const label = `native ${segments.join('/')}`
  const packageRoot = packageRootSegments(segments)
  const manifest = packageRoot === null ? {} : readPlatformManifest(unpackedRoot, packageRoot)

  if (isForeignPlatformPackage(manifest, nativeTarget)) {
    const constraint = `os=${manifest.os ?? 'any'} cpu=${manifest.cpu ?? 'any'}`

    return {
      status: 'skip',
      message: `${label}: never loaded on ${target.platform}-${target.arch} (package ${constraint})`,
    }
  }

  return checkNativeBinary(label, join(unpackedRoot, ...segments), target)
}

function listLoadableNativeBinaries(unpackedRoot, nativeTarget) {
  if (!existsSync(unpackedRoot)) {
    return []
  }

  return readdirSync(unpackedRoot, {
    recursive: true,
  })
    .filter((entry) => entry.endsWith('.node'))
    .map((entry) => entry.split(sep))
    .filter((segments) => !isForeignPrebuild(segments, nativeTarget))
}

function runChecks(target, context) {
  const unpackedRoot = join(context.resourcesDir, 'app.asar.unpacked')
  const nativeTarget = toNativeTarget(target)
  const required = nativeBinaryExpectations(nativeTarget)
  const requiredPaths = new Set(required.map((expectation) => expectation.segments.join(sep)))
  const extraBinaries = listLoadableNativeBinaries(unpackedRoot, nativeTarget)
    .filter((segments) => !requiredPaths.has(segments.join(sep)))

  return [
    ...context.installerPaths.map((filePath) => checkFile('installer', filePath)),
    checkFile('executable', context.executablePath),
    checkFile('app.asar', join(context.resourcesDir, 'app.asar')),
    ...required.map((expectation) =>
      checkNativeBinary(expectation.label, join(unpackedRoot, ...expectation.segments), target)),
    ...extraBinaries.map((segments) =>
      checkExtraNativeBinary(segments, unpackedRoot, target, nativeTarget)),
  ]
}

function printPaths(paths) {
  const missing = paths.filter((filePath) => !existsSync(filePath))

  if (missing.length > 0) {
    throw new Error(`not found: ${missing.join(', ')}`)
  }
  paths.forEach((filePath) => {
    console.log(filePath)
  })
}

function main() {
  const request = parseVerifyCliArgs(process.argv.slice(2))
  const context = loadContext(request.target)

  if (request.print !== null) {
    printPaths(request.print === 'executable' ? [context.executablePath] : context.installerPaths)

    return
  }

  const label = `${request.target.platform}-${request.target.arch}`
  const results = runChecks(request.target, context)
  const failures = results.filter((result) => result.status === 'fail')

  console.log(`verify-package ${label} (${context.identity.packageName} ${context.identity.version})`)
  results.forEach((result) => {
    console.log(`  ${STATUS_MARKS[result.status]} ${result.message}`)
  })

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} check(s) failed for ${label}`)
    process.exit(1)
  }

  console.log(`\n✓ ${label} package verified`)
}

try {
  main()
} catch (error) {
  console.error(`✗ verify-package: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
