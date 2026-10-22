/**
 * Passive global key observer built on libuiohook.
 *
 * Unlike Electron's `globalShortcut`, this observes keypresses without
 * consuming them — the focused app still receives the key event normally.
 * This lets us detect a Cmd+C+C chord without blocking the system copy or
 * needing to simulate a replacement keystroke (which previously caused an
 * infinite feedback loop).
 */

export interface HookKeyEvent {
  keycode: number
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export interface HookLike {
  on: (event: 'keydown', listener: (e: HookKeyEvent) => void) => void
  off: (event: 'keydown', listener: (e: HookKeyEvent) => void) => void
  start: () => void
  stop: () => void
}

export type ModifierKey = 'meta' | 'ctrl'

export interface KeyObserverOptions {
  keycode: number
  modifier: ModifierKey
  onKey: () => void
  hook?: HookLike
}

export interface KeyObserver {
  start: () => void
  stop: () => void
}

function resolveDefaultHook(): HookLike {
  // Imported lazily to keep unit tests independent of the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('uiohook-napi') as { uIOhook: HookLike }

  return mod.uIOhook
}

/**
 * Build a passive key observer that fires `onKey` whenever the configured
 * key is pressed while the configured modifier is held.
 *
 * The observer is inert until `start()` is called. `stop()` detaches the
 * listener and halts the underlying hook.
 */
export function createKeyObserver(options: KeyObserverOptions): KeyObserver {
  const hook = options.hook ?? resolveDefaultHook()

  let started = false

  function listener(event: HookKeyEvent): void {
    if (event.keycode !== options.keycode) {
      return
    }

    const modifierActive = options.modifier === 'meta'
      ? event.metaKey
      : event.ctrlKey

    if (!modifierActive) {
      return
    }

    options.onKey()
  }

  function start(): void {
    if (started) {
      return
    }

    hook.on('keydown', listener)
    hook.start()
    started = true
  }

  function stop(): void {
    if (!started) {
      return
    }

    hook.off('keydown', listener)

    try {
      hook.stop()
    } catch {
      // libuiohook occasionally throws on stop during app shutdown; safe to
      // ignore because the process is exiting anyway.
    }

    started = false
  }

  return {
    start,
    stop,
  }
}
