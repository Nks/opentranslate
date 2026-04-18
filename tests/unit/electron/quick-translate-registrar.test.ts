import {
  describe, expect, it, vi,
} from 'vitest'
import {
  createQuickTranslateRegistrar,
  type ObserverFactoryInput,
} from '@electron/services/shortcuts/quick-translate-registrar'
import type {
  ChordDetector,
} from '@electron/services/shortcuts/chord-detector'
import type {
  KeyObserver,
} from '@electron/services/shortcuts/key-observer'

/**
 * Minimal fake chord detector. Fires the registered callback only on the
 * second `tap()` within the window — matches the real detector's contract
 * well enough for this suite.
 */
function makeFakeDetector(): ChordDetector & {
  getCb: () => (() => void) | null
  destroyed: () => boolean
} {
  let cb: (() => void) | null = null
  let destroyed = false
  let taps = 0

  return {
    tap: vi.fn(() => {
      taps += 1

      if (taps >= 2) {
        taps = 0
        cb?.()
      }
    }),
    reset: () => {
      taps = 0
    },
    onChord(callback) {
      cb = callback
    },
    destroy: () => {
      destroyed = true
      cb = null
      taps = 0
    },
    getCb: () => cb,
    destroyed: () => destroyed,
  }
}

function makeFakeObserver(): KeyObserver & {
  started: () => boolean
  stopped: () => boolean
  forceStart?: () => void
  startSpy: ReturnType<typeof vi.fn>
  stopSpy: ReturnType<typeof vi.fn>
} {
  let isStarted = false
  let didStop = false
  const startSpy = vi.fn(() => {
    isStarted = true
  })
  const stopSpy = vi.fn(() => {
    didStop = true
    isStarted = false
  })

  return {
    start: startSpy,
    stop: stopSpy,
    started: () => isStarted,
    stopped: () => didStop,
    startSpy,
    stopSpy,
  }
}

// Matches the subset of `UiohookKey` we touch in tests.
const KEY_MAP = {
  C: 46,
  T: 20,
  F5: 63,
} as const

type ObserverFactory = (input: ObserverFactoryInput) => KeyObserver

describe('quick translate registrar', () => {
  it('starts a fresh observer when applied for the first time', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())
    const onChord = vi.fn()

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord,
    })
    const result = registrar.apply('Ctrl+C+C', 'linux')

    expect(result.ok).toBe(true)
    expect(createObserver).toHaveBeenCalledOnce()
    expect(createDetector).toHaveBeenCalledOnce()

    const firstObserver = createObserver.mock.results[0]!
      .value as ReturnType<typeof makeFakeObserver>
    expect(firstObserver.started()).toBe(true)

    expect(registrar.current()?.key).toBe('C')
    expect(registrar.current()?.modifier).toBe('ctrl')
    expect(registrar.current()?.chord).toBe('double')
  })

  it('passes the resolved uiohook keycode to the observer', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())
    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    registrar.apply('Ctrl+T', 'linux')

    expect(createObserver).toHaveBeenCalledWith(
      expect.objectContaining({
        keycode: 20,
        modifier: 'ctrl',
      }),
    )
  })

  it('invokes onChord exactly once per complete chord', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())
    const onChord = vi.fn()

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord,
    })
    registrar.apply('Ctrl+C+C', 'linux')

    // Pull the observer options to trigger onKey manually.
    const firstCall = createObserver.mock.calls[0]

    if (!firstCall) {
      throw new Error('Expected createObserver to have been called')
    }

    const observerInput = firstCall[0]

    if (!observerInput) {
      throw new Error('Expected observer input')
    }
    observerInput.onKey()
    observerInput.onKey()

    expect(onChord).toHaveBeenCalledOnce()
  })

  it('tears down the old observer + detector when re-applied', () => {
    const observers = [makeFakeObserver(), makeFakeObserver()]
    const detectors = [makeFakeDetector(), makeFakeDetector()]
    const createObserver = vi.fn(() => observers.shift()!)
    const createDetector = vi.fn(() => detectors.shift()!)
    const observersSnapshot = [...observers]

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    registrar.apply('Ctrl+C+C', 'linux')
    registrar.apply('Ctrl+T', 'linux')

    const firstObserver = observersSnapshot[0]!
    expect(firstObserver.stopped()).toBe(true)
    expect(registrar.current()?.key).toBe('T')
    expect(registrar.current()?.chord).toBe('single')
  })

  it('returns ok:false and keeps the previous observer alive when the new observer fails to start', () => {
    const goodObserver = makeFakeObserver()
    const failingObserver = makeFakeObserver()
    failingObserver.start = vi.fn(() => {
      throw new Error('Accessibility permission missing')
    })
    const observers = [goodObserver, failingObserver]
    const createObserver = vi.fn(() => observers.shift()!)
    const createDetector = vi.fn(() => makeFakeDetector())

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    const first = registrar.apply('Ctrl+C+C', 'linux')
    expect(first.ok).toBe(true)

    const second = registrar.apply('Ctrl+T', 'linux')
    expect(second.ok).toBe(false)

    if (second.ok) {
      throw new Error('Expected failure result')
    }
    expect(second.reason).toMatch(/accessibility/i)

    // Previous observer was NOT torn down because the replacement failed.
    expect(goodObserver.stopped()).toBe(false)
    expect(registrar.current()?.key).toBe('C')
  })

  it('rejects unknown key names without starting any observer', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    const result = registrar.apply('Ctrl+Q', 'linux')

    expect(result.ok).toBe(false)

    if (result.ok) {
      throw new Error('Expected failure result')
    }
    expect(result.reason).toMatch(/unsupported key/i)
    expect(createObserver).not.toHaveBeenCalled()
  })

  it('rejects malformed accelerator strings without starting any observer', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    const result = registrar.apply('definitely-not-a-shortcut', 'linux')

    expect(result.ok).toBe(false)
    expect(createObserver).not.toHaveBeenCalled()
  })

  it('rejects modifiers that are not meta/ctrl (alt / shift only)', () => {
    const createObserver = vi.fn<ObserverFactory>(() => makeFakeObserver())
    const createDetector = vi.fn(() => makeFakeDetector())

    const registrar = createQuickTranslateRegistrar({
      createObserver,
      createDetector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    const result = registrar.apply('Alt+Shift+T', 'linux')

    expect(result.ok).toBe(false)

    if (result.ok) {
      throw new Error('Expected failure result')
    }
    expect(result.reason).toMatch(/not supported/i)
  })

  it('stop() tears down active observer and clears current state', () => {
    const observer = makeFakeObserver()
    const detector = makeFakeDetector()
    const registrar = createQuickTranslateRegistrar({
      createObserver: () => observer,
      createDetector: () => detector,
      keyMap: KEY_MAP,
      onChord: () => {},
    })
    registrar.apply('Ctrl+C+C', 'linux')
    registrar.stop()

    expect(observer.stopped()).toBe(true)
    expect(detector.destroyed()).toBe(true)
    expect(registrar.current()).toBeNull()
  })
})
