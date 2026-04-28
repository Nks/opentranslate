import {
  describe, expect, it,
} from 'vitest'
import type { Input } from 'electron'
import { isDevToolsShortcut } from '@electron/main/devtools-blocker'

function input(overrides: Partial<Input>): Input {
  return {
    type: 'keyDown',
    key: '',
    code: '',
    isAutoRepeat: false,
    isComposing: false,
    shift: false,
    control: false,
    alt: false,
    meta: false,
    location: 0,
    modifiers: [],
    ...overrides,
  } as Input
}

describe('isDevToolsShortcut', () => {
  it('flags F12 keyDown', () => {
    expect(isDevToolsShortcut(input({ key: 'F12' }))).toBe(true)
  })

  it('flags Ctrl+Shift+I (Windows / Linux)', () => {
    expect(isDevToolsShortcut(input({
      key: 'I',
      control: true,
      shift: true,
    }))).toBe(true)
  })

  it('flags Cmd+Alt+I (macOS)', () => {
    expect(isDevToolsShortcut(input({
      key: 'I',
      meta: true,
      alt: true,
    }))).toBe(true)
  })

  it('accepts the lowercase i variant', () => {
    expect(isDevToolsShortcut(input({
      key: 'i',
      control: true,
      shift: true,
    }))).toBe(true)
  })

  it('ignores keyUp events to avoid double-firing', () => {
    expect(isDevToolsShortcut(input({
      type: 'keyUp',
      key: 'F12',
    }))).toBe(false)
  })

  it('ignores plain Ctrl+I (Italic)', () => {
    expect(isDevToolsShortcut(input({
      key: 'I',
      control: true,
    }))).toBe(false)
  })

  it('ignores Ctrl+Shift+J (different shortcut)', () => {
    expect(isDevToolsShortcut(input({
      key: 'J',
      control: true,
      shift: true,
    }))).toBe(false)
  })
})
