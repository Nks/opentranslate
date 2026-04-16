import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import { createChordDetector } from '@electron/services/shortcuts/chord-detector'

describe('chord detector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('fires callback on double-tap within window', () => {
    const detector = createChordDetector({ windowMs: 500 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(200)
    detector.tap()

    expect(callback).toHaveBeenCalledOnce()
    detector.destroy()
  })

  it('does not fire on single tap', () => {
    const detector = createChordDetector({ windowMs: 500 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(600)

    expect(callback).not.toHaveBeenCalled()
    detector.destroy()
  })

  it('does not fire when second tap is outside window', () => {
    const detector = createChordDetector({ windowMs: 300 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(400)
    detector.tap()

    expect(callback).not.toHaveBeenCalled()
    detector.destroy()
  })

  it('reset clears the pending state', () => {
    const detector = createChordDetector({ windowMs: 500 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    detector.reset()
    vi.advanceTimersByTime(100)
    detector.tap()

    expect(callback).not.toHaveBeenCalled()
    detector.destroy()
  })

  it('fires again after a successful chord and new sequence', () => {
    const detector = createChordDetector({ windowMs: 500 })
    const callback = vi.fn()
    detector.onChord(callback)

    detector.tap()
    vi.advanceTimersByTime(100)
    detector.tap()

    expect(callback).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(600)
    detector.tap()
    vi.advanceTimersByTime(100)
    detector.tap()

    expect(callback).toHaveBeenCalledTimes(2)
    detector.destroy()
  })
})
