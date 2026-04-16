/**
 * Packaging orchestrator.
 *
 * Runs: build:electron → build:renderer → electron-builder.
 *
 * Usage:
 *   node scripts/package.mjs          # full installer for current OS
 *   node scripts/package.mjs --dir    # unpacked dir output (for inspection)
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

// 1. Build Electron main + preload
run('pnpm run build:electron')

// 2. Build Nuxt renderer (static SPA)
run('pnpm run build:renderer')

// 3. Run electron-builder
const builderCmd = dirOnly
  ? 'pnpm exec electron-builder --dir'
  : 'pnpm exec electron-builder'

run(builderCmd)

console.log('\n✓ Packaging complete. Output in release/ directory.\n')
