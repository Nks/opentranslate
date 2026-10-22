import type { Input } from 'electron'

const DEVTOOLS_SHORTCUT_KEYS: ReadonlySet<string> = new Set(['I', 'i'])

export function isDevToolsShortcut(input: Input): boolean {
  if (input.type !== 'keyDown') {
    return false
  }

  if (input.key === 'F12') {
    return true
  }

  if (!DEVTOOLS_SHORTCUT_KEYS.has(input.key)) {
    return false
  }

  const ctrlShiftI = input.control && input.shift
  const altMetaI = input.alt && input.meta

  return ctrlShiftI || altMetaI
}
