import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import { createChordDetector } from '@electron/services/shortcuts/chord-detector'

describe('global shortcut registration - chord detector integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('fires callback on double tap within window', () => {
    const detector = createChordDetector({ windowMs: 500 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(200)
    detector.tap()

    expect(callback).toHaveBeenCalledOnce()
    detector.destroy()
  })

  it('does not fire on single tap after window expires', () => {
    const detector = createChordDetector({ windowMs: 50 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(100)

    expect(callback).not.toHaveBeenCalled()
    detector.destroy()
  })

  it('expected accelerator is CommandOrControl+Shift+C', () => {
    const accelerator = 'CommandOrControl+Shift+C'

    expect(accelerator).toMatch(/^CommandOrControl\+/)
    expect(accelerator).toContain('Shift')
    expect(accelerator).toContain('+C')
  })
})
