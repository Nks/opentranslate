import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'
import { useHandleError } from '@app/composables/useHandleError'

const mockAdd = vi.fn()

/**
 * `useToast` is a Nuxt UI auto-import — it exists as a bare global
 * at runtime. In vitest (no Nuxt context) we stub it on `globalThis`
 * so the composable can call it without an explicit import.
 */
beforeEach(() => {
  ;(globalThis as Record<string, unknown>).useToast = () => ({
    add: mockAdd,
  })
})

afterEach(() => {
  vi.clearAllMocks()
  delete (globalThis as Record<string, unknown>).useToast
})

describe('useHandleError', () => {
  it('shows a toast with the Error message when given an Error', () => {
    const handle = useHandleError()
    handle(new Error('Network failed'))

    expect(mockAdd).toHaveBeenCalledOnce()
    expect(mockAdd).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Network failed',
      color: 'error',
    })
  })

  it('coerces non-Error values to string for the toast description', () => {
    const handle = useHandleError()
    handle('something went wrong')

    expect(mockAdd).toHaveBeenCalledOnce()
    expect(mockAdd).toHaveBeenCalledWith({
      title: 'Error',
      description: 'something went wrong',
      color: 'error',
    })
  })

  it('handles numeric values', () => {
    const handle = useHandleError()
    handle(404)

    expect(mockAdd).toHaveBeenCalledOnce()
    expect(mockAdd).toHaveBeenCalledWith({
      title: 'Error',
      description: '404',
      color: 'error',
    })
  })

  it('handles null gracefully', () => {
    const handle = useHandleError()
    handle(null)

    expect(mockAdd).toHaveBeenCalledOnce()
    expect(mockAdd).toHaveBeenCalledWith({
      title: 'Error',
      description: 'null',
      color: 'error',
    })
  })
})
