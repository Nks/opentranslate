import {
  describe, expect, it,
} from 'vitest'
import { resolveRuntimePaths } from '@electron/main/runtime-paths'

describe('resolveRuntimePaths', () => {
  it('locates preload.cjs alongside the executing main.cjs (dev tree)', () => {
    const paths = resolveRuntimePaths('/abs/repo/dist-electron')

    expect(paths.preloadPath).toBe('/abs/repo/dist-electron/preload.cjs')
  })

  it('locates preload.cjs alongside the executing main.cjs (packed asar)', () => {
    const paths = resolveRuntimePaths('/Applications/X.app/Contents/Resources/app.asar/dist-electron')

    expect(paths.preloadPath).toBe(
      '/Applications/X.app/Contents/Resources/app.asar/dist-electron/preload.cjs',
    )
    expect(paths.preloadPath.endsWith('dist-electron/preload.cjs')).toBe(true)
  })

  it('points renderer entry at .output/public/index.html sibling to dist-electron', () => {
    const paths = resolveRuntimePaths('/abs/repo/dist-electron')

    expect(paths.rendererEntry).toBe('/abs/repo/.output/public/index.html')
  })

  it('points renderer entry at the asar-relative .output/public when packed', () => {
    const paths = resolveRuntimePaths('/A.app/Contents/Resources/app.asar/dist-electron')

    expect(paths.rendererEntry).toBe(
      '/A.app/Contents/Resources/app.asar/.output/public/index.html',
    )
  })

  it('points smoke entry at dist-electron/smoke.html', () => {
    const paths = resolveRuntimePaths('/abs/repo/dist-electron')

    expect(paths.smokeEntry).toBe('/abs/repo/dist-electron/smoke.html')
  })

  it('points tray icon base dir at build/icons/tray sibling to dist-electron', () => {
    const paths = resolveRuntimePaths('/abs/repo/dist-electron')

    expect(paths.trayIconBaseDir).toBe('/abs/repo/build/icons/tray')
  })

  it('resolves the same shape regardless of cwd', () => {
    const fromRepoRoot = resolveRuntimePaths('/repo/dist-electron')
    const fromSubdir = resolveRuntimePaths('/repo/dist-electron')

    expect(fromRepoRoot).toEqual(fromSubdir)
    expect(fromRepoRoot.preloadPath.endsWith('dist-electron/preload.cjs')).toBe(true)
  })
})
