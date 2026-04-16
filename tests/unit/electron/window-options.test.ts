import {
  describe, expect, it,
} from 'vitest'
import {
  createWindowOptions,
} from '@electron/main/window-factory'

describe('createWindowOptions', () => {
  const options = createWindowOptions({
    preloadPath: '/tmp/preload.cjs',
  })

  it('enforces contextIsolation = true', () => {
    expect(options.webPreferences?.contextIsolation).toBe(true)
  })

  it('enforces nodeIntegration = false', () => {
    expect(options.webPreferences?.nodeIntegration).toBe(false)
  })

  it('enforces sandbox = true', () => {
    expect(options.webPreferences?.sandbox).toBe(true)
  })

  it('disables dangerous webSecurity override', () => {
    expect(options.webPreferences?.webSecurity).not.toBe(false)
  })

  it('points to the provided preload path', () => {
    expect(options.webPreferences?.preload).toBe('/tmp/preload.cjs')
  })

  it('has show = false so the window does not flash before content loads', () => {
    expect(options.show).toBe(false)
  })
})
