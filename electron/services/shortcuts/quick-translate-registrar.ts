/**
 * Stateful registrar for the quick-translate chord shortcut.
 *
 * Holds the currently-active passive key observer + chord detector and
 * provides a clean `apply(config)` entry point. Re-applying with a new
 * shortcut tears down the previous pair before starting a new one, so
 * the renderer can change the shortcut at runtime without restarting
 * the app.
 *
 * The registrar is deliberately agnostic of the Electron runtime: it
 * takes a `createObserver`/`createDetector`/`keyMap` tuple so unit tests
 * can drive it with fakes. The main process wires it to `createKeyObserver`,
 * `createChordDetector`, and `UiohookKey`.
 */
import type {
  QuickTranslateShortcut,
} from '@shared/shortcuts/quick-translate'
import {
  parseQuickTranslateShortcut,
  resolveUiohookKeycode,
} from '@shared/shortcuts/quick-translate'
import type {
  KeyObserver,
  ModifierKey,
} from '@electron/services/shortcuts/key-observer'
import type {
  ChordDetector,
} from '@electron/services/shortcuts/chord-detector'

export interface ObserverFactoryInput {
  keycode: number
  modifier: ModifierKey
  onKey: () => void
}

export interface RegistrarDeps {
  createObserver: (input: ObserverFactoryInput) => KeyObserver
  createDetector: () => ChordDetector
  keyMap: Readonly<Record<string, unknown>>
  onChord: () => void
  logger?: (message: string, err?: unknown) => void
}

export type RegistrarApplyResult =
  | {
    ok: true
    shortcut: QuickTranslateShortcut
  }
  | {
    ok: false
    reason: string
  }

export interface QuickTranslateRegistrar {
  apply: (accelerator: string, platform?: NodeJS.Platform) => RegistrarApplyResult
  stop: () => void
  current: () => QuickTranslateShortcut | null
}

/**
 * Quick-translate chord registrar. See module doc for the full contract.
 *
 * `apply` is idempotent — calling it with the same accelerator twice
 * rebuilds the observer but otherwise has no observable effect.
 */
export function createQuickTranslateRegistrar(
  deps: RegistrarDeps,
): QuickTranslateRegistrar {
  let observer: KeyObserver | null = null
  let detector: ChordDetector | null = null
  let active: QuickTranslateShortcut | null = null

  function teardown(): void {
    if (observer) {
      try {
        observer.stop()
      } catch (err) {
        deps.logger?.('[quick-translate] observer.stop threw', err)
      }
      observer = null
    }

    if (detector) {
      detector.destroy()
      detector = null
    }
    active = null
  }

  function applyInternal(
    shortcut: QuickTranslateShortcut,
  ): RegistrarApplyResult {
    const keycode = resolveUiohookKeycode(shortcut.key, deps.keyMap)

    if (keycode === null) {
      return {
        ok: false,
        reason: `Unsupported key "${shortcut.key}" for global shortcut`,
      }
    }

    // Only meta/ctrl are honored by the current key observer; alt/shift
    // aren't exposed through uiohook's modifier filter. We surface the
    // limitation instead of silently ignoring it.
    if (shortcut.modifier !== 'meta' && shortcut.modifier !== 'ctrl') {
      return {
        ok: false,
        reason:
          `Primary modifier "${shortcut.modifier}" is not supported for ` +
          `the global quick-translate shortcut`,
      }
    }

    const nextDetector = deps.createDetector()
    const onKey = shortcut.chord === 'double'
      ? () => nextDetector.tap()
      : () => deps.onChord()

    if (shortcut.chord === 'double') {
      nextDetector.onChord(deps.onChord)
    }

    const nextObserver = deps.createObserver({
      keycode,
      modifier: shortcut.modifier,
      onKey,
    })

    try {
      nextObserver.start()
    } catch (err) {
      deps.logger?.('[quick-translate] observer.start failed', err)
      nextDetector.destroy()

      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      }
    }

    teardown()
    detector = nextDetector
    observer = nextObserver
    active = shortcut

    return {
      ok: true,
      shortcut,
    }
  }

  function apply(
    accelerator: string,
    platform: NodeJS.Platform = process.platform,
  ): RegistrarApplyResult {
    let parsed: QuickTranslateShortcut

    try {
      parsed = parseQuickTranslateShortcut(accelerator, platform)
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      }
    }

    return applyInternal(parsed)
  }

  return {
    apply,
    stop: teardown,
    current: () => active,
  }
}
