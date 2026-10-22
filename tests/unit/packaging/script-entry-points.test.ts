import {
  describe, expect, it,
} from 'vitest'
import {
  spawnSync, type SpawnSyncReturns,
} from 'node:child_process'
import {
  readFileSync, readdirSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'

interface ScriptsTsconfig {
  compilerOptions?: Record<string, unknown>
}

const rootDir: string = resolve(__dirname, '..', '..', '..')
const packagingDir: string = resolve(rootDir, 'scripts', 'packaging')
const IMPORT_SPECIFIER: RegExp = /from '([^']+)'/g
const ALLOWED_SPECIFIER: RegExp = /^(?:node:[\w/]+|\.\/[\w-]+\.ts)$/

function runScript(script: string, args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 30_000,
  })
}

describe('script entry points under Node type stripping', () => {
  it.each([
    ['scripts/package.mjs', ['--arch=sparc'], /✗ package: Unknown arch "sparc"/],
    ['scripts/verify-package.mjs', [], /✗ verify-package: Usage: verify-package/],
    ['scripts/verify-package.mjs', ['--platform', 'linux', '--arch', 'arm64'], /Unsupported target linux-arm64/],
  ])('%s %j loads its TypeScript modules and rejects the arguments', (
    script: string,
    args: string[],
    expected: RegExp,
  ) => {
    const result: SpawnSyncReturns<string> = runScript(script, args)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(expected)
  })
})

describe('scripts TypeScript scope', () => {
  it('type-checks scripts/ as erasable-only syntax with verbatim module syntax', () => {
    const tsconfig: ScriptsTsconfig = JSON.parse(
      readFileSync(resolve(rootDir, 'scripts', 'tsconfig.json'), 'utf8'),
    ) as ScriptsTsconfig
    const pkg: { scripts: Record<string, string> } = JSON.parse(
      readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }

    expect(tsconfig.compilerOptions).toEqual(expect.objectContaining({
      erasableSyntaxOnly: true,
      verbatimModuleSyntax: true,
      allowImportingTsExtensions: true,
    }))
    expect(pkg.scripts.typecheck).toContain('tsc -p scripts/tsconfig.json --noEmit')
  })

  it.each(readdirSync(packagingDir).filter((file: string): boolean => file.endsWith('.ts')))(
    'scripts/packaging/%s imports only node: builtins and ./sibling.ts modules',
    (file: string) => {
      const source: string = readFileSync(resolve(packagingDir, file), 'utf8')
      const specifiers: string[] = [...source.matchAll(IMPORT_SPECIFIER)]
        .map((match: RegExpExecArray): string => match[1] ?? '')

      specifiers.forEach((specifier: string): void => {
        expect(specifier).toMatch(ALLOWED_SPECIFIER)
      })
    },
  )
})
