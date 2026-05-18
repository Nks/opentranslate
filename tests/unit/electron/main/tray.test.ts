import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest'

interface TrayInstance {
  setToolTip: ReturnType<typeof vi.fn>
  setContextMenu: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
}

interface NativeImageInstance {
  setTemplateImage: ReturnType<typeof vi.fn>
  isTemplateImage: () => boolean
}

interface MenuItemTemplate {
  label?: string
  type?: string
  click?: () => void
  enabled?: boolean
}

interface MenuInstance {
  items: MenuItemTemplate[]
}

const trayConstructorMock = vi.fn()
const menuBuildFromTemplateMock = vi.fn()
const nativeImageFromPathMock = vi.fn()
const trayInstances: TrayInstance[] = []

vi.mock('electron', () => {
  return {
    Tray: vi.fn().mockImplementation((image: unknown): TrayInstance => {
      trayConstructorMock(image)
      const instance: TrayInstance = {
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        destroy: vi.fn(),
        on: vi.fn(),
      }
      trayInstances.push(instance)

      return instance
    }),
    Menu: {
      buildFromTemplate: vi.fn((template: MenuItemTemplate[]): MenuInstance => {
        menuBuildFromTemplateMock(template)
        const instance: MenuInstance = {
          items: template,
        }

        return instance
      }),
    },
    nativeImage: {
      createFromPath: vi.fn((iconPath: string): NativeImageInstance => {
        nativeImageFromPathMock(iconPath)
        let templateFlag = false
        const instance: NativeImageInstance = {
          setTemplateImage: vi.fn((value: boolean): void => {
            templateFlag = value
          }),
          isTemplateImage: (): boolean => templateFlag,
        }

        return instance
      }),
    },
  }
})

import {
  createTray, type TrayDeps,
} from '@electron/main/tray'

function makeDeps(overrides: Partial<TrayDeps> = {}): TrayDeps {
  return {
    platform: 'linux',
    iconBaseDir: '/fake/icons',
    onOpen: vi.fn(),
    onQuickTranslate: vi.fn(),
    onQuit: vi.fn(),
    ...overrides,
  }
}

describe('createTray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trayInstances.length = 0
  })

  afterEach(() => {
    vi.clearAllMocks()
    trayInstances.length = 0
  })

  it('returns a service that exposes setVisible and destroy', () => {
    const tray = createTray(makeDeps())

    expect(typeof tray.setVisible).toBe('function')
    expect(typeof tray.destroy).toBe('function')
  })

  it('builds a tray with three menu items: Open, Quick Translate, Quit', () => {
    createTray(makeDeps()).setVisible(true)

    expect(menuBuildFromTemplateMock).toHaveBeenCalledTimes(1)
    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemTemplate[]
    const labels = template
      .filter((entry: MenuItemTemplate): boolean => entry.type !== 'separator')
      .map((entry: MenuItemTemplate): string | undefined => entry.label)

    expect(labels).toContain('Open OpenTranslate')
    expect(labels).toContain('Quick Translate')
    expect(labels).toContain('Quit')
  })

  it('wires Open to onOpen callback', () => {
    const onOpen = vi.fn()
    createTray(makeDeps({ onOpen })).setVisible(true)

    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemTemplate[]
    const openItem = template.find(
      (entry: MenuItemTemplate): boolean => entry.label === 'Open OpenTranslate',
    )!
    openItem.click?.()

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('wires Quick Translate to onQuickTranslate callback', () => {
    const onQuickTranslate = vi.fn()
    createTray(makeDeps({ onQuickTranslate })).setVisible(true)

    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemTemplate[]
    const quickItem = template.find(
      (entry: MenuItemTemplate): boolean => entry.label === 'Quick Translate',
    )!
    quickItem.click?.()

    expect(onQuickTranslate).toHaveBeenCalledTimes(1)
  })

  it('wires Quit to onQuit callback', () => {
    const onQuit = vi.fn()
    createTray(makeDeps({ onQuit })).setVisible(true)

    const template = menuBuildFromTemplateMock.mock.calls[0]![0] as MenuItemTemplate[]
    const quitItem = template.find(
      (entry: MenuItemTemplate): boolean => entry.label === 'Quit',
    )!
    quitItem.click?.()

    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('uses a .png icon on linux', () => {
    createTray(makeDeps({ platform: 'linux' })).setVisible(true)

    expect(nativeImageFromPathMock).toHaveBeenCalledTimes(1)
    const iconPath = nativeImageFromPathMock.mock.calls[0]![0] as string
    expect(iconPath).toMatch(/\.png$/)
  })

  it('uses an .ico icon on windows', () => {
    createTray(makeDeps({ platform: 'win32' })).setVisible(true)

    expect(nativeImageFromPathMock).toHaveBeenCalledTimes(1)
    const iconPath = nativeImageFromPathMock.mock.calls[0]![0] as string
    expect(iconPath).toMatch(/\.ico$/)
  })

  it('uses a template image on macOS (Template suffix)', () => {
    createTray(makeDeps({ platform: 'darwin' })).setVisible(true)

    expect(nativeImageFromPathMock).toHaveBeenCalledTimes(1)
    const iconPath = nativeImageFromPathMock.mock.calls[0]![0] as string
    expect(iconPath).toMatch(/Template@?2?x?\.png$/)
  })

  it('does not create a tray on setVisible(false) when none exists', () => {
    createTray(makeDeps()).setVisible(false)

    expect(trayConstructorMock).not.toHaveBeenCalled()
  })

  it('destroys the underlying Tray when setVisible(false) is called after show', () => {
    const tray = createTray(makeDeps())
    tray.setVisible(true)

    expect(trayConstructorMock).toHaveBeenCalledTimes(1)
    expect(trayInstances).toHaveLength(1)
    const created = trayInstances[0]!
    tray.setVisible(false)

    expect(created.destroy).toHaveBeenCalledTimes(1)
  })

  it('calling setVisible(true) twice does not create a second Tray', () => {
    const tray = createTray(makeDeps())
    tray.setVisible(true)
    tray.setVisible(true)

    expect(trayConstructorMock).toHaveBeenCalledTimes(1)
  })

  it('destroy tears down the underlying Tray', () => {
    const tray = createTray(makeDeps())
    tray.setVisible(true)

    expect(trayInstances).toHaveLength(1)
    const created = trayInstances[0]!
    tray.destroy()

    expect(created.destroy).toHaveBeenCalledTimes(1)
  })
})
