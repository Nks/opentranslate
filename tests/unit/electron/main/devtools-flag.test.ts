import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest'

const appState: {
  isPackaged: boolean
} = {
  isPackaged: false,
}

vi.mock('electron', () => {
  return {
    get app() {
      return appState
    },
    BrowserWindow: vi.fn(),
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
      handle: vi.fn(),
    },
    net: {
      fetch: vi.fn(),
    },
  }
})

let isDevToolsAllowed: () => boolean
const originalDevToolsEnv: string | undefined = process.env.OPENTRANSLATE_DEVTOOLS

beforeEach(async () => {
  delete process.env.OPENTRANSLATE_DEVTOOLS
  appState.isPackaged = false
  const moduleUnderTest = await import('@electron/main/main-window')
  isDevToolsAllowed = moduleUnderTest.isDevToolsAllowed
})

afterEach(() => {
  if (originalDevToolsEnv === undefined) {
    delete process.env.OPENTRANSLATE_DEVTOOLS
  } else {
    process.env.OPENTRANSLATE_DEVTOOLS = originalDevToolsEnv
  }
})

describe('isDevToolsAllowed', () => {
  it('allows DevTools in unpackaged (dev) builds', () => {
    appState.isPackaged = false

    expect(isDevToolsAllowed()).toBe(true)
  })

  it('blocks DevTools in packaged builds by default', () => {
    appState.isPackaged = true

    expect(isDevToolsAllowed()).toBe(false)
  })

  it('allows DevTools in packaged builds when the env flag is set to 1', () => {
    appState.isPackaged = true
    process.env.OPENTRANSLATE_DEVTOOLS = '1'

    expect(isDevToolsAllowed()).toBe(true)
  })

  it('keeps DevTools blocked in packaged builds for any other env flag value', () => {
    appState.isPackaged = true
    process.env.OPENTRANSLATE_DEVTOOLS = '0'

    expect(isDevToolsAllowed()).toBe(false)
  })
})
