import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import type { CloseBehavior } from '@shared/types/settings'
import {
  handleMainWindowClose,
  type CloseHandlerDeps,
} from '@electron/main/main-window-close'

interface FakeEvent {
  defaultPrevented: boolean
  preventDefault: () => void
}

interface FakeWindow {
  hidden: boolean
  isVisible: () => boolean
  hide: () => void
  webContents: {
    sent: Array<{
      channel: string
      payload: unknown
    }>
    send: (channel: string, payload: unknown) => void
  }
}

function makeEvent(): FakeEvent {
  const event: FakeEvent = {
    defaultPrevented: false,
    preventDefault: (): void => {
      event.defaultPrevented = true
    },
  }

  return event
}

function makeWindow(): FakeWindow {
  const window: FakeWindow = {
    hidden: false,
    isVisible: (): boolean => !window.hidden,
    hide: (): void => {
      window.hidden = true
    },
    webContents: {
      sent: [],
      send: (channel: string, payload: unknown): void => {
        window.webContents.sent.push({
          channel,
          payload,
        })
      },
    },
  }

  return window
}

function makeDeps(
  overrides: Partial<CloseHandlerDeps> & {
    behavior?: CloseBehavior
    trayActive?: boolean
  } = {},
): CloseHandlerDeps & {
  quit: ReturnType<typeof vi.fn>
} {
  const quit = vi.fn()
  const behavior: CloseBehavior = overrides.behavior ?? 'hide'
  const trayActive: boolean = overrides.trayActive ?? true
  const isQuitting = overrides.isQuitting ?? ((): boolean => false)

  return {
    getCloseBehavior: (): CloseBehavior => behavior,
    isTrayActive: (): boolean => trayActive,
    isQuitting,
    quit,
  }
}

describe('handleMainWindowClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides window and prevents default when behavior=hide and tray active', () => {
    const event = makeEvent()
    const window = makeWindow() as unknown as Parameters<typeof handleMainWindowClose>[2]
    const deps = makeDeps({
      behavior: 'hide',
      trayActive: true,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window,
    )

    expect(event.defaultPrevented).toBe(true)
    expect((window as unknown as FakeWindow).hidden).toBe(true)
    expect(deps.quit).not.toHaveBeenCalled()
  })

  it('allows default close when behavior=quit (no preventDefault)', () => {
    const event = makeEvent()
    const window = makeWindow() as unknown as Parameters<typeof handleMainWindowClose>[2]
    const deps = makeDeps({
      behavior: 'quit',
      trayActive: true,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window,
    )

    expect(event.defaultPrevented).toBe(false)
    expect((window as unknown as FakeWindow).hidden).toBe(false)
    expect(deps.quit).not.toHaveBeenCalled()
  })

  it('sends window:close-request IPC and prevents default when behavior=ask and tray active', () => {
    const event = makeEvent()
    const window = makeWindow()
    const deps = makeDeps({
      behavior: 'ask',
      trayActive: true,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window as unknown as Parameters<typeof handleMainWindowClose>[2],
    )

    expect(event.defaultPrevented).toBe(true)
    expect(window.hidden).toBe(false)
    expect(window.webContents.sent).toHaveLength(1)
    expect(window.webContents.sent[0]!.channel).toBe('window:close-request')
  })

  it('allows default close when tray is inactive even if behavior=hide', () => {
    const event = makeEvent()
    const window = makeWindow()
    const deps = makeDeps({
      behavior: 'hide',
      trayActive: false,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window as unknown as Parameters<typeof handleMainWindowClose>[2],
    )

    expect(event.defaultPrevented).toBe(false)
    expect(window.hidden).toBe(false)
  })

  it('allows default close when tray is inactive even if behavior=ask', () => {
    const event = makeEvent()
    const window = makeWindow()
    const deps = makeDeps({
      behavior: 'ask',
      trayActive: false,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window as unknown as Parameters<typeof handleMainWindowClose>[2],
    )

    expect(event.defaultPrevented).toBe(false)
    expect(window.hidden).toBe(false)
    expect(window.webContents.sent).toHaveLength(0)
  })

  it('allows default close when isQuitting=true regardless of behavior', () => {
    const event = makeEvent()
    const window = makeWindow()
    const deps = makeDeps({
      behavior: 'hide',
      trayActive: true,
      isQuitting: (): boolean => true,
    })
    handleMainWindowClose(
      event as unknown as Parameters<typeof handleMainWindowClose>[0],
      deps,
      window as unknown as Parameters<typeof handleMainWindowClose>[2],
    )

    expect(event.defaultPrevented).toBe(false)
    expect(window.hidden).toBe(false)
  })
})
