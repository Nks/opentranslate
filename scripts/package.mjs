/**
 * Packaging orchestrator.
 *
 * Runs: build:electron → build:renderer → per-arch electron-rebuild → electron-builder.
 *
 * Per-arch native rebuild is required because npmRebuild is disabled
 * (uiohook-napi + node-gyp 9 + Python 3.12 incompatibility), so each
 * target architecture needs its own better-sqlite3 binary baked in.
 *
 * Usage:
 *   node scripts/package.mjs            # full installer(s) for current platform
 *   node scripts/package.mjs --dir      # unpacked dir output (for inspection)
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

const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(scriptDir, '..')
const dirOnly = process.argv.includes('--dir')

function run(cmd) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })
}

function rebuildForArch(arch) {
  run(`pnpm exec electron-rebuild -f -o better-sqlite3 --arch=${arch}`)
}

function builderFlag() {
  return dirOnly ? ' --dir' : ''
}

function buildMac() {
  rebuildForArch('x64')
  run(`pnpm exec electron-builder --mac --x64${builderFlag()}`)
  rebuildForArch('arm64')
  run(`pnpm exec electron-builder --mac --arm64${builderFlag()}`)
}

function buildWin() {
  rebuildForArch('x64')
  run(`pnpm exec electron-builder --win --x64${builderFlag()}`)
}

function buildLinux() {
  rebuildForArch('x64')
  run(`pnpm exec electron-builder --linux --x64${builderFlag()}`)
}

function buildHostPlatform() {
  if (process.platform === 'darwin') {
    buildMac()

    return
  }

  if (process.platform === 'win32') {
    buildWin()

    return
  }

  if (process.platform === 'linux') {
    buildLinux()

    return
  }

  throw new Error(`Unsupported platform: ${process.platform}`)
}

run('pnpm run build:electron')
run('pnpm run build:renderer')

buildHostPlatform()

console.log('\n✓ Packaging complete. Output in release/ directory.\n')
