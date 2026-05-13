import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import type {
  CloseBehavior,
} from '@shared/types/settings'
import {
  createAppSettingsApplier,
  type CloseBehaviorHolder,
  type TrayLifecycle,
} from '@electron/main/app-settings-applier'

interface HolderState {
  value: CloseBehavior
}

function makeHolder(initial: CloseBehavior): CloseBehaviorHolder & {
  state: HolderState
} {
  const state: HolderState = { value: initial }

  return {
    state,
    get: (): CloseBehavior => state.value,
    set: (next: CloseBehavior): void => {
      state.value = next
    },
  }
}

interface TrayState {
  visible: boolean
  ensure: ReturnType<typeof vi.fn>
  teardown: ReturnType<typeof vi.fn>
}

function makeTray(initialVisible: boolean): TrayLifecycle & {
  state: TrayState
} {
  const state: TrayState = {
    visible: initialVisible,
    ensure: vi.fn((): void => {
      state.visible = true
    }),
    teardown: vi.fn((): void => {
      state.visible = false
    }),
  }

  return {
    state,
    isVisible: (): boolean => state.visible,
    ensure: state.ensure,
    teardown: state.teardown,
  }
}

describe('appSettingsApplier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes the new closeBehavior into the holder on every apply', () => {
    const holder = makeHolder('ask')
    const tray = makeTray(true)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: true,
      closeBehavior: 'quit',
    })

    expect(holder.state.value).toBe('quit')
  })

  it('updates closeBehavior even when nothing else changes', () => {
    const holder = makeHolder('hide')
    const tray = makeTray(true)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: true,
      closeBehavior: 'ask',
    })

    expect(holder.state.value).toBe('ask')
    expect(tray.state.ensure).not.toHaveBeenCalled()
    expect(tray.state.teardown).not.toHaveBeenCalled()
  })

  it('tears the tray down when showTray flips from true to false', () => {
    const holder = makeHolder('hide')
    const tray = makeTray(true)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: false,
      closeBehavior: 'hide',
    })

    expect(tray.state.teardown).toHaveBeenCalledTimes(1)
    expect(tray.state.ensure).not.toHaveBeenCalled()
    expect(tray.state.visible).toBe(false)
  })

  it('creates the tray when showTray flips from false to true', () => {
    const holder = makeHolder('quit')
    const tray = makeTray(false)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: true,
      closeBehavior: 'quit',
    })

    expect(tray.state.ensure).toHaveBeenCalledTimes(1)
    expect(tray.state.teardown).not.toHaveBeenCalled()
    expect(tray.state.visible).toBe(true)
  })

  it('is a no-op for the tray when showTray matches current visibility', () => {
    const holder = makeHolder('ask')
    const tray = makeTray(true)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: true,
      closeBehavior: 'ask',
    })
    applier.apply({
      showTray: true,
      closeBehavior: 'hide',
    })

    expect(tray.state.ensure).not.toHaveBeenCalled()
    expect(tray.state.teardown).not.toHaveBeenCalled()
  })

  it('honors the latest tray decision over subsequent calls', () => {
    const holder = makeHolder('ask')
    const tray = makeTray(true)
    const applier = createAppSettingsApplier({
      closeBehaviorHolder: holder,
      tray,
    })
    applier.apply({
      showTray: false,
      closeBehavior: 'quit',
    })

    expect(tray.state.teardown).toHaveBeenCalledTimes(1)
    expect(tray.state.visible).toBe(false)

    applier.apply({
      showTray: true,
      closeBehavior: 'quit',
    })

    expect(tray.state.ensure).toHaveBeenCalledTimes(1)
    expect(tray.state.visible).toBe(true)
  })
})
