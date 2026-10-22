import {
  describe, expect, it,
} from 'vitest'
import { sep } from 'node:path'
import {
  resolveRuntimePaths,
  type RuntimePaths,
} from '@electron/main/runtime-paths'

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join('/')
}

function posixRuntimePaths(distElectronDir: string): RuntimePaths {
  const paths: RuntimePaths = resolveRuntimePaths(distElectronDir)

  return {
    preloadPath: toPosixPath(paths.preloadPath),
    distElectronDir: toPosixPath(paths.distElectronDir),
    rendererEntry: toPosixPath(paths.rendererEntry),
    smokeEntry: toPosixPath(paths.smokeEntry),
    trayIconBaseDir: toPosixPath(paths.trayIconBaseDir),
  }
}

describe('resolveRuntimePaths', () => {
  it('locates preload.cjs alongside the executing main.cjs (dev tree)', () => {
    const paths: RuntimePaths = posixRuntimePaths('/abs/repo/dist-electron')

    expect(paths.preloadPath).toBe('/abs/repo/dist-electron/preload.cjs')
  })

  it('locates preload.cjs alongside the executing main.cjs (packed asar)', () => {
    const paths: RuntimePaths = posixRuntimePaths('/Applications/X.app/Contents/Resources/app.asar/dist-electron')

    expect(paths.preloadPath).toBe(
      '/Applications/X.app/Contents/Resources/app.asar/dist-electron/preload.cjs',
    )
    expect(paths.preloadPath.endsWith('dist-electron/preload.cjs')).toBe(true)
  })

  it('points renderer entry at .output/public/index.html sibling to dist-electron', () => {
    const paths: RuntimePaths = posixRuntimePaths('/abs/repo/dist-electron')

    expect(paths.rendererEntry).toBe('/abs/repo/.output/public/index.html')
  })

  it('points renderer entry at the asar-relative .output/public when packed', () => {
    const paths: RuntimePaths = posixRuntimePaths('/A.app/Contents/Resources/app.asar/dist-electron')

    expect(paths.rendererEntry).toBe(
      '/A.app/Contents/Resources/app.asar/.output/public/index.html',
    )
  })

  it('points smoke entry at dist-electron/smoke.html', () => {
    const paths: RuntimePaths = posixRuntimePaths('/abs/repo/dist-electron')

    expect(paths.smokeEntry).toBe('/abs/repo/dist-electron/smoke.html')
  })

  it('points tray icon base dir at build/icons/tray sibling to dist-electron', () => {
    const paths: RuntimePaths = posixRuntimePaths('/abs/repo/dist-electron')

    expect(paths.trayIconBaseDir).toBe('/abs/repo/build/icons/tray')
  })

  it('resolves the same shape regardless of cwd', () => {
    const fromRepoRoot: RuntimePaths = posixRuntimePaths('/repo/dist-electron')
    const fromSubdir: RuntimePaths = posixRuntimePaths('/repo/dist-electron')

    expect(fromRepoRoot).toEqual(fromSubdir)
    expect(fromRepoRoot.preloadPath.endsWith('dist-electron/preload.cjs')).toBe(true)
  })

  it('emits platform-native separators so Electron can load the files on Windows', () => {
    const paths: RuntimePaths = resolveRuntimePaths(['', 'repo', 'dist-electron'].join(sep))

    expect(paths.preloadPath).toBe(['', 'repo', 'dist-electron', 'preload.cjs'].join(sep))
  })
})
