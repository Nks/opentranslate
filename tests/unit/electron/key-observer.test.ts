import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import {
  createKeyObserver,
  type HookKeyEvent,
  type HookLike,
} from '@electron/services/shortcuts/key-observer'

function createFakeHook(): HookLike & {
  emit: (event: HookKeyEvent) => void
  started: () => boolean
  stopped: () => boolean
} {
  let listener: ((e: HookKeyEvent) => void) | null = null
  let isStarted = false
  let didStop = false

  return {
    on(_event, cb) {
      listener = cb
    },
    off(_event, cb) {
      if (listener === cb) {
        listener = null
      }
    },
    start() {
      isStarted = true
    },
    stop() {
      didStop = true
      isStarted = false
    },
    emit(event) {
      listener?.(event)
    },
    started() {
      return isStarted
    },
    stopped() {
      return didStop
    },
  }
}

const BASE_EVENT: HookKeyEvent = {
  keycode: 46,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
}

describe('key observer', () => {
  let hook: ReturnType<typeof createFakeHook>
  let onKey: ReturnType<typeof vi.fn>

  beforeEach(() => {
    hook = createFakeHook()
    onKey = vi.fn()
  })

  it('fires onKey when matching keycode + meta modifier is pressed', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })
    observer.start()

    hook.emit({
      ...BASE_EVENT,
      keycode: 46,
      metaKey: true,
    })

    expect(onKey).toHaveBeenCalledOnce()
  })

  it('fires onKey when matching keycode + ctrl modifier is pressed', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'ctrl',
      onKey,
      hook,
    })
    observer.start()

    hook.emit({
      ...BASE_EVENT,
      keycode: 46,
      ctrlKey: true,
    })

    expect(onKey).toHaveBeenCalledOnce()
  })

  it('ignores presses without the configured modifier', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })
    observer.start()

    hook.emit({
      ...BASE_EVENT,
      keycode: 46,
    })
    hook.emit({
      ...BASE_EVENT,
      keycode: 46,
      ctrlKey: true,
    })

    expect(onKey).not.toHaveBeenCalled()
  })

  it('ignores presses of other keycodes', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })
    observer.start()

    hook.emit({
      ...BASE_EVENT,
      keycode: 47,
      metaKey: true,
    })

    expect(onKey).not.toHaveBeenCalled()
  })

  it('does not start the hook twice', () => {
    const startSpy = vi.spyOn(hook, 'start')
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })

    observer.start()
    observer.start()

    expect(startSpy).toHaveBeenCalledOnce()
  })

  it('stop detaches listener and halts the hook', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })

    observer.start()
    observer.stop()

    hook.emit({
      ...BASE_EVENT,
      keycode: 46,
      metaKey: true,
    })

    expect(onKey).not.toHaveBeenCalled()
    expect(hook.stopped()).toBe(true)
  })

  it('stop is safe to call before start', () => {
    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })

    expect(() => observer.stop()).not.toThrow()
    expect(hook.stopped()).toBe(false)
  })

  it('swallows errors from hook.stop during shutdown', () => {
    hook.stop = () => {
      throw new Error('hook already stopped')
    }

    const observer = createKeyObserver({
      keycode: 46,
      modifier: 'meta',
      onKey,
      hook,
    })
    observer.start()

    expect(() => observer.stop()).not.toThrow()
  })
})
