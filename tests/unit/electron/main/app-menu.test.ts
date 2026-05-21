import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'

interface MenuInstance {
  items: MenuItemConstructorOptions[]
}

const menuBuildFromTemplateMock = vi.fn()

vi.mock('electron', () => {
  return {
    Menu: {
      buildFromTemplate: vi.fn((template: MenuItemConstructorOptions[]): MenuInstance => {
        menuBuildFromTemplateMock(template)

        return {
          items: template,
        }
      }),
    },
  }
})

import {
  buildAppMenu, buildAppMenuTemplate,
} from '@electron/main/app-menu'

function collectRoles(template: MenuItemConstructorOptions[]): string[] {
  const roles: string[] = []

  function walk(items: readonly MenuItemConstructorOptions[]): void {
    for (const item of items) {
      if (typeof item.role === 'string') {
        roles.push(item.role)
      }

      if (Array.isArray(item.submenu)) {
        walk(item.submenu)
      }
    }
  }

  walk(template)

  return roles
}

function findSubmenuByRole(
  template: MenuItemConstructorOptions[],
  role: string,
): MenuItemConstructorOptions[] {
  const parent = template.find(
    (item: MenuItemConstructorOptions): boolean => item.role === role,
  )

  if (parent && Array.isArray(parent.submenu)) {
    return parent.submenu
  }

  return []
}

describe('buildAppMenuTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('omits toggleDevTools entirely when allowDevTools is false', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'darwin',
    })

    const roles = collectRoles(template)

    expect(roles).not.toContain('toggleDevTools')
  })

  it('includes exactly one toggleDevTools when allowDevTools is true', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: true,
      appName: 'X',
      platform: 'darwin',
    })

    const roles = collectRoles(template)
    const toggleCount = roles.filter(
      (role: string): boolean => role === 'toggleDevTools',
    ).length

    expect(toggleCount).toBe(1)
  })

  it('keeps the Edit menu copy/paste/selectAll roles when devtools hidden', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'darwin',
    })

    const editSubmenu = findSubmenuByRole(template, 'editMenu')
    const roles = collectRoles([{
      role: 'editMenu',
      submenu: editSubmenu,
    }])

    expect(roles).toContain('copy')
    expect(roles).toContain('paste')
    expect(roles).toContain('selectAll')
  })

  it('keeps the Edit menu copy/paste/selectAll roles when devtools shown', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: true,
      appName: 'X',
      platform: 'win32',
    })

    const roles = collectRoles(template)

    expect(roles).toContain('copy')
    expect(roles).toContain('paste')
    expect(roles).toContain('selectAll')
  })

  it('does not leave a dangling separator at the View submenu edges when devtools hidden', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'darwin',
    })

    const viewSubmenu = findSubmenuByRole(template, 'viewMenu')

    expect(viewSubmenu.length).toBeGreaterThan(0)

    const firstItem = viewSubmenu[0]!
    const lastItem = viewSubmenu[viewSubmenu.length - 1]!

    expect(firstItem.type).not.toBe('separator')
    expect(lastItem.type).not.toBe('separator')
  })

  it('does not produce consecutive separators in the View submenu', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'win32',
    })

    const viewSubmenu = findSubmenuByRole(template, 'viewMenu')

    let previousWasSeparator = false

    for (const item of viewSubmenu) {
      const isSeparator = item.type === 'separator'
      const consecutive = isSeparator && previousWasSeparator

      expect(consecutive).toBe(false)
      previousWasSeparator = isSeparator
    }
  })

  it('omits the macOS app menu on non-darwin platforms', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'win32',
    })

    const roles = collectRoles(template)

    expect(roles).not.toContain('appMenu')
  })

  it('includes the macOS app menu on darwin', () => {
    const template = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'darwin',
    })

    const roles = collectRoles(template)

    expect(roles).toContain('appMenu')
  })

  it('includes pasteAndMatchStyle in the Edit menu only on darwin', () => {
    const macTemplate = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'darwin',
    })
    const winTemplate = buildAppMenuTemplate({
      allowDevTools: false,
      appName: 'X',
      platform: 'win32',
    })

    expect(collectRoles(macTemplate)).toContain('pasteAndMatchStyle')
    expect(collectRoles(winTemplate)).not.toContain('pasteAndMatchStyle')
  })
})

describe('buildAppMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('wraps the template via Menu.buildFromTemplate', () => {
    buildAppMenu({
      allowDevTools: false,
      appName: 'X',
    })

    expect(menuBuildFromTemplateMock).toHaveBeenCalledTimes(1)
  })

  it('passes a template with no toggleDevTools when devtools disabled', () => {
    buildAppMenu({
      allowDevTools: false,
      appName: 'X',
    })

    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemConstructorOptions[]

    expect(collectRoles(template)).not.toContain('toggleDevTools')
  })

  it('passes a template with one toggleDevTools when devtools enabled', () => {
    buildAppMenu({
      allowDevTools: true,
      appName: 'X',
    })

    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemConstructorOptions[]
    const toggleCount = collectRoles(template).filter(
      (role: string): boolean => role === 'toggleDevTools',
    ).length

    expect(toggleCount).toBe(1)
  })
})
