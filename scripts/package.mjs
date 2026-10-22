/**
 * Packaging orchestrator: build:electron → build:renderer → per-arch
 * electron-rebuild → electron-builder (--publish never).
 *
 * npmRebuild is disabled (uiohook-napi + node-gyp 9 + Python 3.12), so each
 * target arch gets its own better-sqlite3 rebuild before its builder run.
 *
 * Usage:
 *   node scripts/package.mjs                 # host platform, default arches
 *   node scripts/package.mjs --arch=arm64    # single arch
 *   node scripts/package.mjs --dir           # unpacked dir output
 */
import {
  execSync,
} from 'node:child_process'
import {
  fileURLToPath,
} from 'node:url'
import {
  dirname, resolve,
} from 'node:path'
import {
  parsePackageCliArgs,
} from './packaging/targets.ts'
import {
  planPackageCommands,
} from './packaging/package-plan.ts'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command) {
  console.log(`\n> ${command}\n`)
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })
}

function main() {
  const request = parsePackageCliArgs(process.argv.slice(2), process.platform)

  planPackageCommands(request, process.arch).forEach(run)
  console.log(`\n✓ Packaged ${request.platform} ${request.arches.join(', ')}. Output in release/.\n`)
}

try {
  main()
} catch (error) {
  console.error(`✗ package: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
