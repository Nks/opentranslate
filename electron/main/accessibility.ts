import {
  dialog, shell, systemPreferences,
} from 'electron'
import { WARNING_COPY } from '@electron/main/quick-translate-messages'

const ACCESSIBILITY_URL: string =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'

export function ensureAccessibilityPermission(): boolean {
  if (process.platform !== 'darwin') {
    return true
  }

  const trusted: boolean = systemPreferences.isTrustedAccessibilityClient(false)

  if (trusted) {
    return true
  }

  void dialog
    .showMessageBox({
      type: 'info',
      title: WARNING_COPY.accessibility.title,
      message: WARNING_COPY.accessibility.message,
      detail: WARNING_COPY.accessibility.detail,
      buttons: [
        WARNING_COPY.accessibility.openSettings,
        WARNING_COPY.accessibility.later,
      ],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result): void => {
      if (result.response === 0) {
        systemPreferences.isTrustedAccessibilityClient(true)
        void shell.openExternal(ACCESSIBILITY_URL)
      }
    })

  return false
}
