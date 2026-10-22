import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest'
import {
  createQuickTranslateController,
  type QuickTranslateControllerDeps,
} from '@electron/main/quick-translate-controller'
import {
  createChordDetector,
} from '@electron/services/shortcuts/chord-detector'

/**
 * The controller lazy-loads `uiohook-napi` inside `buildRegistrar` via
 * `require`. Unit tests mock the module so Node's CommonJS require cache
 * serves our fake instead of the native binary.
 */
vi.mock('uiohook-napi', () => {
  return {
    UiohookKey: {
      C: 46,
      T: 20,
    },
    uIOhook: {
      on: () => {},
      off: () => {},
      start: () => {},
      stop: () => {},
    },
  }
})

/**
 * The registrar pulls in the real key-observer factory. We stub the
 * uiohook hook dependency so `observer.start()` succeeds without native
 * bindings.
 */
vi.mock('@electron/services/shortcuts/key-observer', () => {
  return {
    createKeyObserver: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  }
})

vi.mock('@electron/services/shortcuts/chord-detector', () => {
  return {
    createChordDetector: vi.fn(() => ({
      tap: vi.fn(),
      reset: vi.fn(),
      onChord: vi.fn(),
      destroy: vi.fn(),
    })),
  }
})

function makeDeps(
  overrides: Partial<QuickTranslateControllerDeps> = {},
): QuickTranslateControllerDeps & {
  showWarningSpy: ReturnType<typeof vi.fn>
  sendSpy: ReturnType<typeof vi.fn>
  ensurePermission: ReturnType<typeof vi.fn>
  onAppExitListeners: Array<() => void>
} {
  const showWarningSpy = vi.fn()
  const sendSpy = vi.fn()
  const ensurePermission = vi.fn(() => true)
  const onAppExitListeners: Array<() => void> = []

  return {
    ensureAccessibilityPermission: ensurePermission,
    readClipboardText: async () => '',
    sendTextToMainWindow: sendSpy,
    showWarning: showWarningSpy,
    logger: () => {},
    onAppExit: (listener: () => void) => {
      onAppExitListeners.push(listener)
    },
    platform: 'linux',
    ...overrides,
    showWarningSpy,
    sendSpy,
    ensurePermission,
    onAppExitListeners,
  } as QuickTranslateControllerDeps & {
    showWarningSpy: ReturnType<typeof vi.fn>
    sendSpy: ReturnType<typeof vi.fn>
    ensurePermission: ReturnType<typeof vi.fn>
    onAppExitListeners: Array<() => void>
  }
}

const CLIPBOARD_READ_DELAY_MS: number = 100

function fireRegisteredChord(): void {
  const detector: ReturnType<typeof createChordDetector> = vi
    .mocked(createChordDetector)
    .mock
    .results
    .at(-1)
    ?.value
  const onChordListener: (() => void) | undefined = vi.mocked(detector.onChord).mock.calls[0]?.[0]

  expect(onChordListener).toBeTypeOf('function')
  onChordListener?.()
}

describe('quick-translate controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not register when Accessibility permission is missing', () => {
    const deps = makeDeps({
      ensureAccessibilityPermission: vi.fn(() => false),
    })
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    expect(controller.registrar()).toBeNull()
    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('registers the observer on start when permission is granted', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    expect(controller.registrar()?.current()?.key).toBe('C')
    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('does not register when the shortcut is disabled in settings', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', false)

    expect(controller.registrar()).toBeNull()
    expect(deps.ensurePermission).not.toHaveBeenCalled()
  })

  it('surfaces a warning when start receives a malformed accelerator', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('definitely-not-valid', true)

    expect(deps.showWarningSpy).toHaveBeenCalledOnce()
    const call = deps.showWarningSpy.mock.calls[0]![0] as { title: string }
    expect(call.title).toBe('Quick Translate unavailable')
  })

  it('applyFromSettings is a no-op when nothing changed', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    controller.applyFromSettings('Ctrl+C+C', true)

    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('applyFromSettings starts the observer when re-enabled after Accessibility was granted', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', false)
    expect(controller.registrar()).toBeNull()

    controller.applyFromSettings('Ctrl+T+T', true)

    expect(controller.registrar()?.current()?.key).toBe('T')
    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('applyFromSettings tears the observer down when disabled', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)
    const registrar = controller.registrar()
    const stopSpy = vi.spyOn(registrar!, 'stop')

    controller.applyFromSettings('Ctrl+C+C', false)

    expect(stopSpy).toHaveBeenCalledOnce()
    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('applyFromSettings switches to a new valid accelerator', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)
    expect(controller.registrar()?.current()?.key).toBe('C')

    controller.applyFromSettings('Ctrl+T+T', true)
    expect(controller.registrar()?.current()?.key).toBe('T')
    expect(deps.showWarningSpy).not.toHaveBeenCalled()
  })

  it('applyFromSettings warns and keeps the old shortcut when the new one is malformed', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    controller.applyFromSettings('not+a+real+shortcut', true)

    expect(deps.showWarningSpy).toHaveBeenCalledOnce()
    const warning = deps.showWarningSpy.mock.calls[0]![0] as {
      title: string
      detail: string
    }
    expect(warning.title).toBe('Quick Translate shortcut not applied')
    expect(warning.detail).toContain('previous shortcut')
    expect(controller.registrar()?.current()?.key).toBe('C')
  })

  it('registers a teardown listener on startup', () => {
    const deps = makeDeps()
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    expect(deps.onAppExitListeners.length).toBe(1)
  })

  it('forwards trimmed clipboard text read asynchronously after the chord fires', async () => {
    const deps = makeDeps({
      readClipboardText: vi.fn(async () => '  hello world  '),
    })
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    fireRegisteredChord()
    await vi.advanceTimersByTimeAsync(CLIPBOARD_READ_DELAY_MS)

    expect(deps.sendSpy).toHaveBeenCalledOnce()
    expect(deps.sendSpy).toHaveBeenCalledWith('hello world')
  })

  it('does not forward whitespace-only clipboard text', async () => {
    const deps = makeDeps({
      readClipboardText: vi.fn(async () => '   '),
    })
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    fireRegisteredChord()
    await vi.advanceTimersByTimeAsync(CLIPBOARD_READ_DELAY_MS)

    expect(deps.sendSpy).not.toHaveBeenCalled()
  })

  it('logs clipboard read failures instead of swallowing them', async () => {
    const failure: Error = new Error('clipboard unavailable')
    const loggerSpy = vi.fn()
    const deps = makeDeps({
      readClipboardText: vi.fn(async () => {
        throw failure
      }),
      logger: loggerSpy,
    })
    const controller = createQuickTranslateController(deps)
    controller.start('Ctrl+C+C', true)

    fireRegisteredChord()
    await vi.advanceTimersByTimeAsync(CLIPBOARD_READ_DELAY_MS)

    expect(deps.sendSpy).not.toHaveBeenCalled()
    expect(loggerSpy).toHaveBeenCalledWith('[quick-translate] clipboard read failed', failure)
  })
})
