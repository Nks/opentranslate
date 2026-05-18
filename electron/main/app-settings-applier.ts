import type {
  AppSettings,
  CloseBehavior,
} from '@shared/types/settings'

/**
 * Mutable holder + setter abstraction for the `closeBehavior` value that
 * both `electron/main/index.ts` (the IPC close-response listener) and
 * `electron/main/main-window-close.ts` (the BrowserWindow close handler)
 * read. The applier writes through this holder so both consumers see the
 * fresh value on every settings change without a restart.
 */
export interface CloseBehaviorHolder {
  get: () => CloseBehavior
  set: (next: CloseBehavior) => void
}

/**
 * Lifecycle hooks the applier uses to bring the tray service in line with
 * the latest `showTray` setting. `isVisible()` reports whether a tray
 * service is currently mounted; `ensure()` creates one if missing;
 * `teardown()` destroys the active service if any.
 */
export interface TrayLifecycle {
  isVisible: () => boolean
  ensure: () => void
  teardown: () => void
}

export interface AppSettingsApplierDeps {
  closeBehaviorHolder: CloseBehaviorHolder
  tray: TrayLifecycle
}

export interface AppSettingsApplier {
  apply: (next: Pick<AppSettings, 'showTray' | 'closeBehavior'>) => void
}

/**
 * Builds the applier wired to the supplied holder + tray lifecycle. The
 * caller is responsible for keeping `closeBehaviorHolder.get()` and
 * `tray.isVisible()` consistent with the rest of the main process.
 *
 * The applier is intentionally synchronous: settings persistence happens
 * before the applier runs (see `electron/main/ipc-setup.ts`), and the
 * tray + close-behavior side-effects are local to the main process.
 */
export function createAppSettingsApplier(
  deps: AppSettingsApplierDeps,
): AppSettingsApplier {
  return {
    apply: (next: Pick<AppSettings, 'showTray' | 'closeBehavior'>): void => {
      deps.closeBehaviorHolder.set(next.closeBehavior)

      const trayCurrentlyVisible: boolean = deps.tray.isVisible()

      if (next.showTray && !trayCurrentlyVisible) {
        deps.tray.ensure()

        return
      }

      if (!next.showTray && trayCurrentlyVisible) {
        deps.tray.teardown()
      }
    },
  }
}
