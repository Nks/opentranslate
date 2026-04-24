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
import {
  WARNING_COPY,
} from '@electron/main/quick-translate-messages'

export interface QuickTranslateControllerDeps {
  ensureAccessibilityPermission: () => boolean
  readClipboardText: () => string
  sendTextToMainWindow: (text: string) => void
  showWarning: (input: {
    title: string
    message: string
    detail: string
  }) => void
  logger?: (message: string, err?: unknown) => void
  onAppExit: (listener: () => void) => void
  platform: NodeJS.Platform
}

export interface QuickTranslateController {
  start: (accelerator: string, enabled: boolean) => void
  applyFromSettings: (accelerator: string, enabled: boolean) => void
  registrar: () => QuickTranslateRegistrar | null
}

// Delay clipboard read so the foreground app has time to finish its copy
// between the two physical key presses of a chord.
const CLIPBOARD_READ_DELAY_MS: number = 100
const CHORD_WINDOW_MS: number = 500

export function createQuickTranslateController(
  deps: QuickTranslateControllerDeps,
): QuickTranslateController {
  let registrar: QuickTranslateRegistrar | null = null
  let lastApplied: string | null = null
  let lastEnabled: boolean = false

  function buildRegistrar(): QuickTranslateRegistrar {
    const registrarDeps: Parameters<typeof createQuickTranslateRegistrar>[0] = deps.logger
      ? {
          createObserver: createKeyObserver,
          createDetector: (): ReturnType<typeof createChordDetector> =>
            createChordDetector({ windowMs: CHORD_WINDOW_MS }),
          keyMap: loadUiohookKeyMap(),
          onChord: handleChord,
          logger: deps.logger,
        }
      : {
          createObserver: createKeyObserver,
          createDetector: (): ReturnType<typeof createChordDetector> =>
            createChordDetector({ windowMs: CHORD_WINDOW_MS }),
          keyMap: loadUiohookKeyMap(),
          onChord: handleChord,
        }
    const built: QuickTranslateRegistrar = createQuickTranslateRegistrar(registrarDeps)
    deps.onAppExit((): void => {
      built.stop()
    })

    return built
  }

  function handleChord(): void {
    setTimeout((): void => {
      const text: string = deps.readClipboardText().trim()

      if (text.length === 0) {
        return
      }
      deps.sendTextToMainWindow(text)
    }, CLIPBOARD_READ_DELAY_MS)
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

  function registerObserver(accelerator: string): boolean {
    if (!deps.ensureAccessibilityPermission()) {
      return false
    }

    registrar ??= buildRegistrar()

    const result: ReturnType<QuickTranslateRegistrar['apply']> = registrar.apply(accelerator)

    if (!result.ok) {
      deps.logger?.('[shortcuts] quick-translate registration failed', result.reason)
      deps.showWarning({
        title: WARNING_COPY.unavailable.title,
        message: WARNING_COPY.unavailable.message,
        detail: `${deps.platform === 'darwin'
          ? WARNING_COPY.unavailable.detailDarwin
          : WARNING_COPY.unavailable.detailOther}\n\nDetails: ${result.reason}`,
      })

      return false
    }

    return true
  }

  function start(accelerator: string, enabled: boolean): void {
    lastEnabled = enabled

    if (!enabled) {
      lastApplied = accelerator

      return
    }

    if (registerObserver(accelerator)) {
      lastApplied = accelerator
    }
  }

  function applyFromSettings(accelerator: string, enabled: boolean): void {
    if (accelerator === lastApplied && enabled === lastEnabled) {
      return
    }

    if (!enabled) {
      registrar?.stop()
      lastApplied = accelerator
      lastEnabled = false

      return
    }

    if (!registrar || !lastEnabled) {
      if (registerObserver(accelerator)) {
        lastApplied = accelerator
        lastEnabled = true
      }

      return
    }

    const result: ReturnType<QuickTranslateRegistrar['apply']> = registrar.apply(accelerator)

    if (!result.ok) {
      deps.logger?.('[shortcuts] quick-translate re-registration failed', result.reason)
      deps.showWarning({
        title: WARNING_COPY.notApplied.title,
        message: WARNING_COPY.notApplied.message,
        detail: `The previous shortcut "${formatPrevious()}" remains active.\n\nDetails: ${result.reason}`,
      })

      return
    }

    lastApplied = accelerator
    lastEnabled = true
  }

  return {
    start,
    applyFromSettings,
    registrar: (): QuickTranslateRegistrar | null => registrar,
  }
}

function loadUiohookKeyMap(): Readonly<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: { UiohookKey: Readonly<Record<string, unknown>> } = require('uiohook-napi')

  return mod.UiohookKey
}
