export type ShortcutModifier = 'meta' | 'ctrl' | 'alt' | 'shift'
export type ShortcutChord = 'single' | 'double'
export type Platform = NodeJS.Platform | 'darwin' | 'win32' | 'linux' | string
export type PlatformKind = 'darwin' | 'other'

export interface QuickTranslateShortcut {
  modifier: ShortcutModifier
  modifiers: ShortcutModifier[]
  key: string
  chord: ShortcutChord
}

const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  win: 'meta',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
}

const CANONICAL_ORDER: ShortcutModifier[] = ['meta', 'ctrl', 'alt', 'shift']

const DISPLAY_LABELS: Record<ShortcutModifier, {
  darwin: string
  other: string
}> = {
  meta: {
    darwin: '⌘',
    other: 'Win',
  },
  ctrl: {
    darwin: '⌃',
    other: 'Ctrl',
  },
  alt: {
    darwin: '⌥',
    other: 'Alt',
  },
  shift: {
    darwin: '⇧',
    other: 'Shift',
  },
}

export const DEFAULT_QUICK_TRANSLATE_ACCELERATOR: string = 'CommandOrControl+C+C'

function toPlatformKind(platform: Platform): PlatformKind {
  return platform === 'darwin' ? 'darwin' : 'other'
}

function resolveCommandOrControl(platform: PlatformKind): ShortcutModifier {
  return platform === 'darwin' ? 'meta' : 'ctrl'
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase()
}

function isModifierToken(token: string): boolean {
  const key: string = normalizeToken(token)

  return key === 'commandorcontrol' ||
    key === 'cmdorctrl' ||
    Object.prototype.hasOwnProperty.call(MODIFIER_ALIASES, key)
}

function mapModifier(token: string, platform: PlatformKind): ShortcutModifier {
  const key: string = normalizeToken(token)

  if (key === 'commandorcontrol' || key === 'cmdorctrl') {
    return resolveCommandOrControl(platform)
  }

  const mapped: ShortcutModifier | undefined = MODIFIER_ALIASES[key]

  if (!mapped) {
    throw new Error(`Unknown modifier "${token}"`)
  }

  return mapped
}

function normalizeKeyName(raw: string): string {
  const trimmed: string = raw.trim()

  if (trimmed.length === 0) {
    throw new Error('Shortcut key segment is empty')
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }

  const fKeyMatch: RegExpExecArray | null = /^[Ff](\d{1,2})$/.exec(trimmed)

  if (fKeyMatch) {
    return `F${fKeyMatch[1]}`
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export function parseQuickTranslateShortcut(
  accelerator: string,
  platform: Platform = process.platform,
): QuickTranslateShortcut {
  if (typeof accelerator !== 'string' || accelerator.trim().length === 0) {
    throw new Error('Shortcut accelerator must be a non-empty string')
  }

  const rawTokens: string[] = accelerator
    .split('+')
    .map((token: string): string => token.trim())
    .filter((token: string): boolean => token.length > 0)

  if (rawTokens.length < 2) {
    throw new Error('Shortcut must include at least one modifier and one key')
  }

  const kind: PlatformKind = toPlatformKind(platform)
  const modifiersOut: ShortcutModifier[] = []
  const nonModifierTokens: string[] = []

  for (const token of rawTokens) {
    if (isModifierToken(token)) {
      const mapped: ShortcutModifier = mapModifier(token, kind)

      if (!modifiersOut.includes(mapped)) {
        modifiersOut.push(mapped)
      }
    } else {
      nonModifierTokens.push(token)
    }
  }

  if (modifiersOut.length === 0) {
    throw new Error('Shortcut must include at least one modifier')
  }

  if (nonModifierTokens.length === 0) {
    throw new Error('Shortcut must include a non-modifier key')
  }

  if (nonModifierTokens.length > 2) {
    throw new Error('Shortcut supports at most two trailing key presses')
  }

  const keyNames: string[] = nonModifierTokens.map(normalizeKeyName)
  let chord: ShortcutChord = 'single'

  if (keyNames.length === 2) {
    if (keyNames[0] !== keyNames[1]) {
      throw new Error('Chord shortcut must repeat the same key twice (e.g. C+C)')
    }
    chord = 'double'
  }

  const canonicalModifiers: ShortcutModifier[] = CANONICAL_ORDER.filter(
    (candidate: ShortcutModifier): boolean => modifiersOut.includes(candidate),
  )

  return {
    modifier: canonicalModifiers[0]!,
    modifiers: canonicalModifiers,
    key: keyNames[0]!,
    chord,
  }
}

export function validateQuickTranslateShortcut(
  accelerator: string,
  platform: Platform = process.platform,
): string[] {
  try {
    parseQuickTranslateShortcut(accelerator, platform)

    return []
  } catch (err: unknown) {
    return [err instanceof Error ? err.message : String(err)]
  }
}

export function formatQuickTranslateShortcut(shortcut: QuickTranslateShortcut): string {
  const modifierLabels: Record<ShortcutModifier, string> = {
    meta: 'Meta',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
  }
  const parts: string[] = shortcut.modifiers.map(
    (modifier: ShortcutModifier): string => modifierLabels[modifier],
  )
  parts.push(shortcut.key)

  if (shortcut.chord === 'double') {
    parts.push(shortcut.key)
  }

  return parts.join('+')
}

export function formatShortcutForDisplay(
  shortcut: QuickTranslateShortcut,
  platform: Platform = process.platform,
): string {
  const kind: PlatformKind = toPlatformKind(platform)
  const parts: string[] = shortcut.modifiers.map(
    (modifier: ShortcutModifier): string => DISPLAY_LABELS[modifier][kind],
  )
  parts.push(shortcut.key)

  if (shortcut.chord === 'double') {
    parts.push(shortcut.key)
  }

  return parts.join('+')
}

export function resolveUiohookKeycode(
  key: string,
  keyMap: Readonly<Record<string, unknown>>,
): number | null {
  const candidate: unknown = keyMap[key]

  if (typeof candidate === 'number') {
    return candidate
  }

  return null
}
