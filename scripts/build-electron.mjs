import {
  build,
} from 'esbuild'
import {
  writeFile, mkdir,
} from 'node:fs/promises'
import {
  fileURLToPath,
} from 'node:url'
import {
  dirname, resolve,
} from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(scriptDir, '..')
const outDir = resolve(rootDir, 'dist-electron')

await mkdir(outDir, {
  recursive: true,
})

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  minify: false,
  format: 'cjs',
  outExtension: {
    '.js': '.cjs',
  },
  external: ['electron', 'better-sqlite3'],
  tsconfig: resolve(rootDir, 'tsconfig.json'),
  alias: {
    '@shared': resolve(rootDir, 'shared'),
    '@electron': resolve(rootDir, 'electron'),
  },
  logLevel: 'info',
}

await build({
  ...sharedOptions,
  entryPoints: [resolve(rootDir, 'electron/main/index.ts')],
  outfile: resolve(rootDir, 'dist-electron/main.cjs'),
})

await build({
  ...sharedOptions,
  entryPoints: [resolve(rootDir, 'electron/preload/index.ts')],
  outfile: resolve(rootDir, 'dist-electron/preload.cjs'),
})

const smokeHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OpenTranslate Desktop — smoke test</title>
  </head>
  <body>
    <p>smoke</p>
  </body>
</html>
`

await writeFile(resolve(outDir, 'smoke.html'), smokeHtml, 'utf8')

console.warn('[build-electron] main.cjs + preload.cjs + smoke.html written to dist-electron/')
