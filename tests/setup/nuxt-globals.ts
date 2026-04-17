/**
 * Global vitest setup — stubs Nuxt / Nuxt UI auto-imports that app
 * composables call as bare globals.
 *
 * At runtime Nuxt's auto-import transform turns `useToast()` into a real
 * import. In unit tests there is no Nuxt context, so bare `useToast` is
 * undefined and any composable using `useHandleError` (and therefore
 * `useToast` underneath) throws. We expose a no-op stub on `globalThis`
 * so bare references resolve cleanly.
 *
 * Tests that need to assert on toast payloads can override the stub
 * inside their own `beforeEach` (see `useHandleError.test.ts`).
 */

import {
  afterEach, beforeEach,
} from 'vitest'

type ToastStub = {
  add: (options: Record<string, unknown>) => void
}

const globals = globalThis as unknown as { useToast?: () => ToastStub }

beforeEach(() => {
  globals.useToast = () => ({
    add: () => {},
  })
})

afterEach(() => {
  delete globals.useToast
})
