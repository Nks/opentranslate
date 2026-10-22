import {
  Menu, Tray, nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron'
import { join } from 'node:path'

export interface TrayDeps {
  platform: NodeJS.Platform
  iconBaseDir: string
  onOpen: () => void
  onQuickTranslate: () => void
  onQuit: () => void
}

export interface TrayService {
  setVisible: (visible: boolean) => void
  destroy: () => void
}

const TRAY_TOOLTIP = 'OpenTranslate Desktop'
const OPEN_LABEL = 'Open OpenTranslate'
const QUICK_TRANSLATE_LABEL = 'Quick Translate'
const QUIT_LABEL = 'Quit'

function resolveIconPath(platform: NodeJS.Platform, iconBaseDir: string): string {
  if (platform === 'darwin') {
    return join(iconBaseDir, 'trayTemplate@2x.png')
  }

  if (platform === 'win32') {
    return join(iconBaseDir, 'tray.ico')
  }

  return join(iconBaseDir, 'tray.png')
}

function buildTrayImage(platform: NodeJS.Platform, iconBaseDir: string): NativeImage {
  const iconPath = resolveIconPath(platform, iconBaseDir)
  const image = nativeImage.createFromPath(iconPath)

  if (platform === 'darwin') {
    image.setTemplateImage(true)
  }

  return image
}

function buildMenu(deps: TrayDeps): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: OPEN_LABEL,
      click: (): void => {
        deps.onOpen()
      },
    },
    {
      label: QUICK_TRANSLATE_LABEL,
      click: (): void => {
        deps.onQuickTranslate()
      },
    },
    {
      type: 'separator',
    },
    {
      label: QUIT_LABEL,
      click: (): void => {
        deps.onQuit()
      },
    },
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * Creates the system-tray service. The tray is platform-aware:
 * macOS uses a template image (`Template@2x.png`) so the OS can re-tint
 * it for light/dark menu bar; Windows uses an `.ico`; Linux uses `.png`.
 *
 * Linux note: tray support requires a working StatusNotifier host (KDE
 * Plasma, recent GNOME with extension, XFCE, …). Vanilla GNOME ships
 * without legacy AppIndicator support; users on those desktops will not
 * see the icon. The app continues to function via the main window.
 */
export function createTray(deps: TrayDeps): TrayService {
  let tray: Tray | null = null

  function show(): void {
    if (tray) {
      return
    }

    const image = buildTrayImage(deps.platform, deps.iconBaseDir)
    tray = new Tray(image)
    tray.setToolTip(TRAY_TOOLTIP)
    tray.setContextMenu(buildMenu(deps))

    tray.on('click', (): void => {
      deps.onOpen()
    })

    tray.on('double-click', (): void => {
      deps.onOpen()
    })
  }

  function hide(): void {
    if (!tray) {
      return
    }
    tray.destroy()
    tray = null
  }

  function setVisible(visible: boolean): void {
    if (visible) {
      show()

      return
    }
    hide()
  }

  function destroy(): void {
    hide()
  }

  return {
    setVisible,
    destroy,
  }
}
