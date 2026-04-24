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
      } catch (err: unknown) {
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

  function applyInternal(shortcut: QuickTranslateShortcut): RegistrarApplyResult {
    const keycode: number | null = resolveUiohookKeycode(shortcut.key, deps.keyMap)

    if (keycode === null) {
      return {
        ok: false,
        reason: `Unsupported key "${shortcut.key}" for global shortcut`,
      }
    }

    // uiohook's modifier filter only honors meta/ctrl; alt/shift are not
    // exposed. Surface the limitation rather than silently ignoring it.
    if (shortcut.modifier !== 'meta' && shortcut.modifier !== 'ctrl') {
      return {
        ok: false,
        reason: `Primary modifier "${shortcut.modifier}" is not supported for the global quick-translate shortcut`,
      }
    }

    const nextDetector: ChordDetector = deps.createDetector()
    const onKey: () => void = shortcut.chord === 'double'
      ? (): void => nextDetector.tap()
      : (): void => deps.onChord()

    if (shortcut.chord === 'double') {
      nextDetector.onChord(deps.onChord)
    }

    const nextObserver: KeyObserver = deps.createObserver({
      keycode,
      modifier: shortcut.modifier,
      onKey,
    })

    try {
      nextObserver.start()
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
