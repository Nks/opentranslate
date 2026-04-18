import {
  describe, expect, it,
} from 'vitest'
import {
  DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
  formatQuickTranslateShortcut,
  formatShortcutForDisplay,
  parseQuickTranslateShortcut,
  resolveUiohookKeycode,
  validateQuickTranslateShortcut,
} from '@shared/shortcuts/quick-translate'

describe('parseQuickTranslateShortcut', () => {
  it('parses the default CommandOrControl+C+C on macOS as a meta chord', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'darwin',
    )

    expect(parsed.modifier).toBe('meta')
    expect(parsed.modifiers).toEqual(['meta'])
    expect(parsed.key).toBe('C')
    expect(parsed.chord).toBe('double')
  })

  it('parses the default CommandOrControl+C+C on Windows as a ctrl chord', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'win32',
    )

    expect(parsed.modifier).toBe('ctrl')
    expect(parsed.modifiers).toEqual(['ctrl'])
    expect(parsed.key).toBe('C')
    expect(parsed.chord).toBe('double')
  })

  it('parses the default CommandOrControl+C+C on Linux as a ctrl chord', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'linux',
    )

    expect(parsed.modifier).toBe('ctrl')
    expect(parsed.chord).toBe('double')
  })

  it('parses single-press shortcuts with multiple modifiers', () => {
    const parsed = parseQuickTranslateShortcut('Ctrl+Shift+T', 'linux')

    expect(parsed.modifier).toBe('ctrl')
    expect(parsed.modifiers).toEqual(['ctrl', 'shift'])
    expect(parsed.key).toBe('T')
    expect(parsed.chord).toBe('single')
  })

  it('normalizes cmd and command aliases to meta', () => {
    const parsed = parseQuickTranslateShortcut('Cmd+K', 'darwin')
    expect(parsed.modifier).toBe('meta')
    expect(parsed.key).toBe('K')

    const parsedTwo = parseQuickTranslateShortcut('Command+K', 'darwin')
    expect(parsedTwo.modifier).toBe('meta')
  })

  it('uppercases single-letter keys', () => {
    const parsed = parseQuickTranslateShortcut('Ctrl+q', 'linux')
    expect(parsed.key).toBe('Q')
  })

  it('preserves function keys like F5', () => {
    const parsed = parseQuickTranslateShortcut('Ctrl+F5', 'linux')
    expect(parsed.key).toBe('F5')
  })

  it('orders modifiers canonically (meta, ctrl, alt, shift)', () => {
    const parsed = parseQuickTranslateShortcut('Shift+Alt+Ctrl+Meta+K', 'darwin')
    expect(parsed.modifiers).toEqual(['meta', 'ctrl', 'alt', 'shift'])
    expect(parsed.modifier).toBe('meta')
  })

  it('rejects empty strings', () => {
    expect(() => parseQuickTranslateShortcut('', 'darwin')).toThrow(
      /non-empty string/i,
    )
  })

  it('rejects shortcuts with no modifier', () => {
    expect(() => parseQuickTranslateShortcut('C', 'darwin')).toThrow(
      /at least one modifier and one key/i,
    )
  })

  it('rejects shortcuts with only modifiers', () => {
    expect(() => parseQuickTranslateShortcut('Ctrl+Shift', 'linux')).toThrow(
      /non-modifier key/i,
    )
  })

  it('rejects plain alpha keys without a modifier', () => {
    // Two-letter chord without modifier should also fail because no modifier.
    expect(() => parseQuickTranslateShortcut('A+A', 'linux')).toThrow(
      /modifier/i,
    )
  })

  it('rejects chord shortcuts where the two keys differ', () => {
    expect(() => parseQuickTranslateShortcut('Ctrl+C+V', 'linux')).toThrow(
      /same key twice/i,
    )
  })

  it('rejects accelerators with more than two trailing keys', () => {
    expect(() => parseQuickTranslateShortcut('Ctrl+C+C+C', 'linux')).toThrow(
      /at most two/i,
    )
  })
})

describe('validateQuickTranslateShortcut', () => {
  it('returns no issues for a valid accelerator', () => {
    expect(validateQuickTranslateShortcut('Ctrl+Shift+T', 'linux')).toEqual([])
  })

  it('returns at least one issue for an invalid accelerator', () => {
    const issues = validateQuickTranslateShortcut('justletters', 'linux')
    expect(issues.length).toBeGreaterThan(0)
  })
})

describe('formatQuickTranslateShortcut', () => {
  it('round-trips a parsed shortcut back to a canonical accelerator', () => {
    const parsed = parseQuickTranslateShortcut('Ctrl+C+C', 'linux')
    expect(formatQuickTranslateShortcut(parsed)).toBe('Ctrl+C+C')
  })

  it('produces a canonical ordering regardless of input order', () => {
    const parsed = parseQuickTranslateShortcut('Shift+Alt+Ctrl+K', 'linux')
    expect(formatQuickTranslateShortcut(parsed)).toBe('Ctrl+Alt+Shift+K')
  })
})

describe('formatShortcutForDisplay', () => {
  it('renders ⌘ on macOS for the meta modifier', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'darwin',
    )

    expect(formatShortcutForDisplay(parsed, 'darwin')).toBe('⌘+C+C')
  })

  it('renders Ctrl spelled out on Windows', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'win32',
    )

    expect(formatShortcutForDisplay(parsed, 'win32')).toBe('Ctrl+C+C')
  })

  it('renders Ctrl spelled out on Linux', () => {
    const parsed = parseQuickTranslateShortcut(
      DEFAULT_QUICK_TRANSLATE_ACCELERATOR,
      'linux',
    )

    expect(formatShortcutForDisplay(parsed, 'linux')).toBe('Ctrl+C+C')
  })
})

describe('resolveUiohookKeycode', () => {
  it('returns the numeric keycode when the key exists in the map', () => {
    const map = {
      C: 46,
      T: 20,
      F5: 63,
    } as const
    expect(resolveUiohookKeycode('C', map)).toBe(46)
    expect(resolveUiohookKeycode('F5', map)).toBe(63)
  })

  it('returns null for unknown key names', () => {
    const map = { C: 46 } as const
    expect(resolveUiohookKeycode('Zzz', map)).toBeNull()
  })
})
