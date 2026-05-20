import {
  describe, expect, it,
} from 'vitest'
import {
  RENDERER_HOST,
  RENDERER_SCHEME,
  RENDERER_URL,
  rendererDirFromEntry,
  resolveRendererAssetPath,
} from '@electron/main/renderer-protocol'

const RENDERER_DIR = '/A.app/Contents/Resources/app.asar/.output/public'

describe('resolveRendererAssetPath', () => {
  it('maps the root path to index.html inside the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/')

    expect(resolved).toBe(`${RENDERER_DIR}/index.html`)
  })

  it('maps an absolute asset path into the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/_nuxt/BGl01Uhq.js')

    expect(resolved).toBe(`${RENDERER_DIR}/_nuxt/BGl01Uhq.js`)
  })

  it('maps a nested asset path into the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/_nuxt/builds/meta/app.json')

    expect(resolved).toBe(`${RENDERER_DIR}/_nuxt/builds/meta/app.json`)
  })

  it('decodes percent-encoded path segments before resolving', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/_nuxt/entry%20copy.css')

    expect(resolved).toBe(`${RENDERER_DIR}/_nuxt/entry copy.css`)
  })

  it('rejects a traversal request that escapes the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/../../etc/passwd')

    expect(resolved).toBeNull()
  })

  it('rejects a deep traversal request that escapes the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/_nuxt/../../../../../../etc/passwd')

    expect(resolved).toBeNull()
  })

  it('rejects an encoded traversal request that escapes the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/%2e%2e/%2e%2e/etc/passwd')

    expect(resolved).toBeNull()
  })

  it('keeps a traversal that stays within the renderer dir', () => {
    const resolved = resolveRendererAssetPath(RENDERER_DIR, '/_nuxt/../index.html')

    expect(resolved).toBe(`${RENDERER_DIR}/index.html`)
  })
})

describe('rendererDirFromEntry', () => {
  it('derives the renderer dir from the renderer entry file', () => {
    const dir = rendererDirFromEntry('/A.app/Contents/Resources/app.asar/.output/public/index.html')

    expect(dir).toBe('/A.app/Contents/Resources/app.asar/.output/public')
  })
})

describe('renderer scheme constants', () => {
  it('builds the renderer url from the scheme and host', () => {
    expect(RENDERER_SCHEME).toBe('app')
    expect(RENDERER_HOST).toBe('app')
    expect(RENDERER_URL).toBe('app://app/')
  })
})
