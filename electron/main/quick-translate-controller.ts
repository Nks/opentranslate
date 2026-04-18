/**
 * Thin controller that owns the quick-translate lifecycle in the main
 * process: macOS Accessibility permission dance, clipboard read on chord,
 * observer registration, and re-registration when the renderer updates
 * the shortcut.
 *
 * All side effects (dialog, permission check, clipboard read, window
 * focus) are injected through `ControllerDeps` so the module stays
 * testable in isolation and main/index.ts stays under the 500-line budget.
 */
import {
  createQuickTranslateRegistrar,
  type QuickTranslateRegistrar,
} from '@electron/services/shortcuts/quick-translate-registrar'
import {
  createChordDetector,
} from '@electron/services/shortcuts/chord-detector'
import {
  createKeyObserver,
} from '@electron/services/shortcuts/key-observer'
import {
  formatShortcutForDisplay,
  parseQuickTranslateShortcut,
} from '@shared/shortcuts/quick-translate'

export interface QuickTranslateControllerDeps {
  /**
   * Returns `true` when the global key observer may start. On macOS this
   * checks for Accessibility permission and, if missing, surfaces the
   * user-facing dialog and returns `false` so the caller can skip
   * registration.
   */
  ensureAccessibilityPermission: () => boolean
  /** Read the current clipboard text. */
  readClipboardText: () => string
  /**
   * Push the captured text into the focused translation window. The
   * controller only calls this when clipboard text is present.
   */
  sendTextToMainWindow: (text: string) => void
  /** Surface a warning to the user (typically an Electron MessageBox). */
  showWarning: (input: {
    title: string
    message: string
    detail: string
  }) => void
  /** Logger for failures; receives a short tag and the offending error. */
  logger?: (message: string, err?: unknown) => void
  /**
   * Register a teardown hook. Called when the registrar is first built
   * so the host app (usually Electron's `will-quit`) can stop the
   * observer cleanly on exit.
   */
  onAppExit: (listener: () => void) => void
  /** `process.platform` — allowed to be injected for tests. */
  platform: NodeJS.Platform
}

export interface QuickTranslateController {
  /** Initial registration during app bootstrap. */
  start: (accelerator: string) => void
  /**
   * Re-apply in response to a user-initiated settings change. Silent
   * when the shortcut has not changed; surfaces a warning when the new
   * observer fails to start and leaves the previous observer active.
   */
  applyFromSettings: (accelerator: string) => void
  /** Current registrar state, primarily for diagnostics. */
  registrar: () => QuickTranslateRegistrar | null
}

export function createQuickTranslateController(
  deps: QuickTranslateControllerDeps,
): QuickTranslateController {
  let registrar: QuickTranslateRegistrar | null = null
  let lastApplied: string | null = null

  function buildRegistrar(): QuickTranslateRegistrar {
    const registrarDeps = deps.logger
      ? {
          createObserver: createKeyObserver,
          createDetector: () => createChordDetector({ windowMs: 500 }),
          keyMap: loadUiohookKeyMap(),
          onChord: handleChord,
          logger: deps.logger,
        }
      : {
          createObserver: createKeyObserver,
          createDetector: () => createChordDetector({ windowMs: 500 }),
          keyMap: loadUiohookKeyMap(),
          onChord: handleChord,
        }
    const built = createQuickTranslateRegistrar(registrarDeps)
    deps.onAppExit(() => {
      built.stop()
    })

    return built
  }

  function handleChord(): void {
    // Small delay so the focused app finishes writing the clipboard after
    // the second physical key press.
    setTimeout(() => {
      const text = deps.readClipboardText().trim()

      if (text.length === 0) {
        return
      }
      deps.sendTextToMainWindow(text)
    }, 100)
  }

  function formatPrevious(): string {
    if (!lastApplied) {
      return '(none)'
    }

    try {
      return formatShortcutForDisplay(parseQuickTranslateShortcut(lastApplied))
    } catch {
      return lastApplied
    }
  }

  function start(accelerator: string): void {
    if (!deps.ensureAccessibilityPermission()) {
      return
    }

    registrar ??= buildRegistrar()

    const result = registrar.apply(accelerator)

    if (!result.ok) {
      deps.logger?.('[shortcuts] quick-translate registration failed', result.reason)

      const message = deps.platform === 'darwin'
        ? 'Could not start the global key observer. Check that ' +
        'OpenTranslate Desktop has Accessibility permission in ' +
        'System Settings → Privacy & Security → Accessibility.'
        : 'Could not start the global key observer. The quick-translate ' +
          'shortcut will be unavailable until the app is restarted.'

      deps.showWarning({
        title: 'Quick Translate unavailable',
        message: 'Quick translate shortcut could not be registered',
        detail: `${message}\n\nDetails: ${result.reason}`,
      })

      return
    }

    lastApplied = accelerator
  }

  function applyFromSettings(accelerator: string): void {
    if (accelerator === lastApplied) {
      return
    }

    if (!registrar) {
      // Startup was skipped (e.g. Accessibility missing). Leave alone.
      return
    }

    const result = registrar.apply(accelerator)

    if (!result.ok) {
      deps.logger?.('[shortcuts] quick-translate re-registration failed', result.reason)
      deps.showWarning({
        title: 'Quick Translate shortcut not applied',
        message: 'The new quick-translate shortcut could not be registered',
        detail:
          `The previous shortcut "${formatPrevious()}" remains active.\n\n` +
          `Details: ${result.reason}`,
      })

      return
    }

    lastApplied = accelerator
  }

  return {
    start,
    applyFromSettings,
    registrar: () => registrar,
  }
}

/**
 * Lazy-load the `UiohookKey` map. Keeps the controller factory free of a
 * direct `uiohook-napi` import, which makes unit tests runnable in
 * environments where the native module isn't available.
 */
function loadUiohookKeyMap(): Readonly<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('uiohook-napi') as { UiohookKey: Readonly<Record<string, unknown>> }

  return mod.UiohookKey
}
