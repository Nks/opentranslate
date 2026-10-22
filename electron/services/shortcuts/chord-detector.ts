/**
 * Chord detector for double-tap keyboard shortcuts.
 *
 * Detects rapid double-press of a key while a modifier is held (e.g.
 * Cmd+C+C). The first press is allowed to pass through to the OS (normal
 * copy); only the second press within the chord window triggers the action.
 */

export interface ChordDetectorOptions {
  windowMs?: number
}

export interface ChordDetector {
  tap: () => void
  reset: () => void
  onChord: (callback: () => void) => void
  destroy: () => void
}

const DEFAULT_WINDOW_MS = 500

export function createChordDetector(
  options?: ChordDetectorOptions,
): ChordDetector {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
  let lastTapTime = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let callback: (() => void) | null = null

  function tap(): void {
    const now = Date.now()
    const elapsed = now - lastTapTime

    if (elapsed <= windowMs && elapsed > 0) {
      lastTapTime = 0

      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      callback?.()
    } else {
      lastTapTime = now
      timer = setTimeout(() => {
        lastTapTime = 0
        timer = null
      }, windowMs)
    }
  }

  function reset(): void {
    lastTapTime = 0

    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onChord(cb: () => void): void {
    callback = cb
  }

  function destroy(): void {
    reset()
    callback = null
  }

  return {
    tap,
    reset,
    onChord,
    destroy,
  }
}
