// @vitest-environment happy-dom
import {
  describe, expect, it, beforeEach,
} from 'vitest'
import {
  setActivePinia, createPinia,
} from 'pinia'
import { useSettingsStore } from '@app/stores/settings'
import { defaultAppSettings } from '@shared/schemas/settings'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default app settings', () => {
    const store = useSettingsStore()

    expect(store.app.debounceMs).toBe(defaultAppSettings.debounceMs)
    expect(store.app.theme).toBe('system')
    expect(store.app.historyEnabled).toBe(true)
  })

  it('allows updating debounce', () => {
    const store = useSettingsStore()
    store.app.debounceMs = 600

    expect(store.app.debounceMs).toBe(600)
  })
})
