/**
 * Verifies electron-builder output for one release target.
 *
 * Resolves the target's installer, executable and resources paths from
 * package.json + electron-builder.yml, then runs the unit-tested checks in
 * scripts/packaging/verify-checks.ts against the real file system.
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
  dirname, join, resolve,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'
import {
  parse as parseYaml,
} from 'yaml'
import {
  parseVerifyCliArgs,
} from './packaging/targets.ts'
import {
  BINARY_HEADER_BYTES,
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
  failedChecks,
  runPackageChecks,
} from './packaging/verify-checks.ts'

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
    locations: {
      displayRoot: rootDir,
      installerPaths: installerFileNames(target, identity, layout)
        .map((name) => join(releaseDir, name)),
      executablePath: packagedExecutablePath(target, identity, unpackedDir),
      resourcesDir: appResourcesDir(target, identity, unpackedDir),
    },
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

const nodeFileSystem = {
  exists: existsSync,
  isNonEmptyFile: (filePath) => existsSync(filePath) && statSync(filePath).size > 0,
  readHeader,
  readText: (filePath) => readFileSync(filePath, 'utf8'),
  listFilesRecursive: (dir) => readdirSync(dir, {
    recursive: true,
  }),
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
    printPaths(request.print === 'executable' ? [context.locations.executablePath] : context.locations.installerPaths)

    return
  }

  const label = `${request.target.platform}-${request.target.arch}`
  const results = runPackageChecks(request.target, context.locations, nodeFileSystem)
  const failures = failedChecks(results)

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
