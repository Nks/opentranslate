import {
  context,
} from 'esbuild'
import {
  spawn,
} from 'node:child_process'
import {
  fileURLToPath,
} from 'node:url'
import {
  dirname, resolve,
} from 'node:path'
import {
  createRequire,
} from 'node:module'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(scriptDir, '..')
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const NUXT_PORT = 3344
const NUXT_URL = `http://localhost:${NUXT_PORT}`

const esbuildAlias = {
  '@shared': resolve(rootDir, 'shared'),
  '@electron': resolve(rootDir, 'electron'),
}

const sharedEsbuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  format: 'cjs',
  outExtension: {
    '.js': '.cjs',
  },
  external: ['electron', 'better-sqlite3', 'uiohook-napi', 'node-gyp-build'],
  tsconfig: resolve(rootDir, 'tsconfig.json'),
  alias: esbuildAlias,
  logLevel: 'info',
}

const mainCtx = await context({
  ...sharedEsbuildOptions,
  entryPoints: [resolve(rootDir, 'electron/main/index.ts')],
  outfile: resolve(rootDir, 'dist-electron/main.cjs'),
})

const preloadCtx = await context({
  ...sharedEsbuildOptions,
  entryPoints: [resolve(rootDir, 'electron/preload/index.ts')],
  outfile: resolve(rootDir, 'dist-electron/preload.cjs'),
})

await mainCtx.rebuild()
await preloadCtx.rebuild()

const nuxt = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(NUXT_PORT)], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NUXT_HOST: 'localhost',
  },
})

let electronProcess = null
let nuxtReady = false

function launchElectron() {
  if (electronProcess) {
    return
  }
  electronProcess = spawn(electronBinary, [resolve(rootDir, 'dist-electron/main.cjs')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: NUXT_URL,
      NODE_ENV: 'development',
    },
  })
  electronProcess.on('exit', () => {
    shutdown(0)
  })
}

async function waitForNuxtReady() {
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(NUXT_URL)

      if (response.ok) {
        nuxtReady = true

        return
      }
    } catch {
      // keep polling until deadline
    }
    await new Promise((res) => setTimeout(res, 300))
  }

  throw new Error(`Nuxt dev server did not become ready at ${NUXT_URL}`)
}

function shutdown(code) {
  if (electronProcess) {
    try {
      electronProcess.kill()
    } catch {
      // already exited
    }
  }

  try {
    nuxt.kill()
  } catch {
    // already exited
  }
  void mainCtx.dispose()
  void preloadCtx.dispose()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

await waitForNuxtReady()

if (nuxtReady) {
  launchElectron()
}
