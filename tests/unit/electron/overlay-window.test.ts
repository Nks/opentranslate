import {
  describe, expect, it,
} from 'vitest'
import { createOverlayWindowOptions } from '@electron/main/overlay-window'

describe('createOverlayWindowOptions', () => {
  const options = createOverlayWindowOptions({ preloadPath: '/tmp/preload.cjs' })

  it('uses frameless window', () => {
    expect(options.frame).toBe(false)
  })

  it('is always on top', () => {
    expect(options.alwaysOnTop).toBe(true)
  })

  it('skips taskbar', () => {
    expect(options.skipTaskbar).toBe(true)
  })

  it('starts hidden', () => {
    expect(options.show).toBe(false)
  })

  it('enforces contextIsolation and disables nodeIntegration', () => {
    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.sandbox).toBe(true)
  })

  it('uses compact dimensions', () => {
    expect(options.width).toBeLessThanOrEqual(600)
    expect(options.height).toBeLessThanOrEqual(400)
  })
})
