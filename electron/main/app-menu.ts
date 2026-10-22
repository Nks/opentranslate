import {
  Menu,
  type Menu as ElectronMenu,
  type MenuItemConstructorOptions,
} from 'electron'

export interface AppMenuOptions {
  allowDevTools: boolean
  appName: string
}

export interface AppMenuTemplateOptions extends AppMenuOptions {
  platform: NodeJS.Platform
}

function buildAppRoleMenu(appName: string): MenuItemConstructorOptions {
  return {
    label: appName,
    role: 'appMenu',
  }
}

function buildEditMenu(isMac: boolean): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
  ]

  if (isMac) {
    submenu.push({ role: 'pasteAndMatchStyle' })
  }

  submenu.push({ role: 'delete' })
  submenu.push({ role: 'selectAll' })

  return {
    role: 'editMenu',
    submenu,
  }
}

function buildViewMenu(allowDevTools: boolean): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    { role: 'reload' },
    { role: 'forceReload' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ]

  if (allowDevTools) {
    submenu.push({ type: 'separator' })
    submenu.push({ role: 'toggleDevTools' })
  }

  return {
    role: 'viewMenu',
    submenu,
  }
}

export function buildAppMenuTemplate(
  options: AppMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  const isMac = options.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push(buildAppRoleMenu(options.appName))
  }

  template.push(buildEditMenu(isMac))
  template.push(buildViewMenu(options.allowDevTools))
  template.push({ role: 'windowMenu' })

  return template
}

export function buildAppMenu(options: AppMenuOptions): ElectronMenu {
  const template = buildAppMenuTemplate({
    ...options,
    platform: process.platform,
  })

  return Menu.buildFromTemplate(template)
}
