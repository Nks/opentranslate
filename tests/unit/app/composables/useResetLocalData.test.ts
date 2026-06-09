// @vitest-environment happy-dom
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'
import type * as UseResetLocalDataModule from '@app/composables/useResetLocalData'

interface ToastCall {
  title: string
  description?: string
  color?: string
}

function setupToastStub(): { add: ReturnType<typeof vi.fn> } {
  const toast: { add: ReturnType<typeof vi.fn> } = {
    add: vi.fn(),
  }
  ;(globalThis as Record<string, unknown>).useToast = (): typeof toast => toast

  return toast
}

function installApiMock(settingsReset: () => Promise<unknown>): void {
  ;(window as unknown as { api: unknown }).api = {
    settings: {
      get: vi.fn(),
      update: vi.fn(),
      reset: settingsReset,
    },
  }
}

async function loadComposable(): Promise<typeof UseResetLocalDataModule> {
  vi.resetModules()

  return import('@app/composables/useResetLocalData')
}

describe('useResetLocalData', () => {
  beforeEach(() => {
    setupToastStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>).useToast
    delete (window as unknown as { api?: unknown }).api
  })

  it('calls the settings:reset IPC handler and returns true on success', async () => {
    const settingsReset: ReturnType<typeof vi.fn> = vi.fn(async () => ({
      app: {},
      providers: {},
    }))
    installApiMock(settingsReset)

    const { useResetLocalData } = await loadComposable()
    const { resetLocalData } = useResetLocalData()
    const ok: boolean = await resetLocalData()

    expect(settingsReset).toHaveBeenCalledOnce()
    expect(ok).toBe(true)
  })

  it('shows a success toast after a successful reset', async () => {
    const toast: ReturnType<typeof setupToastStub> = setupToastStub()
    installApiMock(vi.fn(async () => ({
      app: {},
      providers: {},
    })))

    const { useResetLocalData } = await loadComposable()
    const { resetLocalData } = useResetLocalData()
    await resetLocalData()

    expect(toast.add).toHaveBeenCalledOnce()
    const call: ToastCall = toast.add.mock.calls[0]?.[0] as ToastCall
    expect(call.color).toBe('success')
    expect(call.title).toMatch(/reset/i)
  })

  it('shows an error toast and returns false when the IPC call fails', async () => {
    const toast: ReturnType<typeof setupToastStub> = setupToastStub()
    const boom: Error = new Error('ipc failed')
    installApiMock(vi.fn(async () => {
      throw boom
    }))

    const { useResetLocalData } = await loadComposable()
    const { resetLocalData } = useResetLocalData()
    const ok: boolean = await resetLocalData()

    expect(ok).toBe(false)
    expect(toast.add).toHaveBeenCalled()
    const call: ToastCall = toast.add.mock.calls[0]?.[0] as ToastCall
    expect(call.color).toBe('error')
  })
})
