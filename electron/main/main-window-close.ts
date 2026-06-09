import type {
  BrowserWindow, Event,
} from 'electron'
import type { CloseBehavior } from '@shared/types/settings'
import { eventChannels } from '@electron/ipc/channels'

export interface CloseHandlerDeps {
  getCloseBehavior: () => CloseBehavior
  isTrayActive: () => boolean
  isQuitting: () => boolean
  quit: () => void
}

/**
 * Pure handler for the main window's `close` event.
 *
 * Behavior matrix:
 * - `isQuitting === true`         → allow default close (user chose quit).
 * - `trayActive === false`        → allow default close (no tray fallback).
 * - `closeBehavior === 'hide'`    → preventDefault + win.hide().
 * - `closeBehavior === 'quit'`    → allow default close.
 * - `closeBehavior === 'ask'`     → preventDefault + send IPC to renderer;
 *   the renderer responds with `window:close-response` and the main process
 *   then either hides or quits.
 *
 * The handler does not touch settings; the renderer persists
 * `closeBehavior` via `settings:update` when the user opts to remember.
 */
export function handleMainWindowClose(
  event: Event,
  deps: CloseHandlerDeps,
  window: BrowserWindow,
): void {
  if (deps.isQuitting()) {
    return
  }

  if (!deps.isTrayActive()) {
    return
  }

  const behavior: CloseBehavior = deps.getCloseBehavior()

  if (behavior === 'quit') {
    return
  }

  if (behavior === 'hide') {
    event.preventDefault()
    window.hide()

    return
  }

  // behavior === 'ask'
  event.preventDefault()
  window.webContents.send(eventChannels['window:close-request'], null)
}
