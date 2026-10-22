export interface WarningCopy {
  unavailable: {
    title: string
    message: string
    detailDarwin: string
    detailOther: string
  }
  notApplied: {
    title: string
    message: string
  }
  accessibility: {
    title: string
    message: string
    detail: string
    openSettings: string
    later: string
  }
}

export const WARNING_COPY: WarningCopy = {
  unavailable: {
    title: 'Quick Translate unavailable',
    message: 'Quick translate shortcut could not be registered',
    detailDarwin:
      'Could not start the global key observer. Check that OpenTranslate Desktop ' +
      'has Accessibility permission in System Settings → Privacy & Security → Accessibility.',
    detailOther:
      'Could not start the global key observer. The quick-translate shortcut ' +
      'will be unavailable until the app is restarted.',
  },
  notApplied: {
    title: 'Quick Translate shortcut not applied',
    message: 'The new quick-translate shortcut could not be registered',
  },
  accessibility: {
    title: 'Accessibility permission required',
    message: 'Enable the quick translate shortcut',
    detail:
      'OpenTranslate Desktop needs Accessibility permission to detect the ' +
      'quick-translate chord anywhere on your Mac. Open System Settings → ' +
      'Privacy & Security → Accessibility, enable OpenTranslate Desktop, ' +
      'then relaunch the app.',
    openSettings: 'Open System Settings',
    later: 'Later',
  },
}
