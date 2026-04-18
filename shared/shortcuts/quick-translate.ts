/**
 * Parser + formatter for the quick-translate chord shortcut.
 *
 * The app stores the shortcut as an Electron-style accelerator string
 * (e.g. `"CommandOrControl+C+C"`). That choice keeps the settings file
 * stable across platforms and compatible with the existing schema, while
 * letting the main process build a passive `uiohook-napi` observer
 * without committing to a specific OS in the stored value.
 *
 * The structured form — used by the main process and the settings UI —
 * is:
 *
 * ```
 * {
 *   modifier: 'meta',        // primary modifier for uiohook observer
 *   modifiers: ['meta'],     // all modifiers in canonical order
 *   key: 'C',                // key to double-tap (chord)
 *   chord: 'double',         // fixed for v1: we only support chord mode
 * }
 * ```
 *
 * `CommandOrControl` resolves to `meta` on macOS and `ctrl` elsewhere.
 */
export type ShortcutModifier = 'meta' | 'ctrl' | 'alt' | 'shift'

export type ShortcutChord = 'single' | 'double'

export interface QuickTranslateShortcut {
  /** Primary modifier used by the uiohook key observer. */
  modifier: ShortcutModifier
  /** All modifiers in canonical order (meta, ctrl, alt, shift). */
  modifiers: ShortcutModifier[]
  /** The non-modifier key name (uppercase letters, function keys). */
  key: string
  /** Press pattern: `double` for Cmd+C+C style, `single` for Cmd+Shift+T. */
  chord: ShortcutChord
}

export type PlatformKind = 'darwin' | 'other'

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

/**
 * Default accelerator string baked into the settings schema. The literal
 * `CommandOrControl` token resolves to `meta` on darwin and `ctrl` elsewhere
 * when parsed with a platform hint, so the default is truly platform-aware
 * without requiring different values on disk.
 */
export const DEFAULT_QUICK_TRANSLATE_ACCELERATOR = 'CommandOrControl+C+C'

function toPlatformKind(platform: NodeJS.Platform | string): PlatformKind {
  return platform === 'darwin' ? 'darwin' : 'other'
}

function resolveCommandOrControl(platform: PlatformKind): ShortcutModifier {
  return platform === 'darwin' ? 'meta' : 'ctrl'
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase()
}

function isModifierToken(token: string): boolean {
  const key = normalizeToken(token)

  return key === 'commandorcontrol' ||
    key === 'cmdorctrl' ||
    Object.prototype.hasOwnProperty.call(MODIFIER_ALIASES, key)
}

function mapModifier(token: string, platform: PlatformKind): ShortcutModifier {
  const key = normalizeToken(token)

  if (key === 'commandorcontrol' || key === 'cmdorctrl') {
    return resolveCommandOrControl(platform)
  }

  const mapped = MODIFIER_ALIASES[key]

  if (!mapped) {
    throw new Error(`Unknown modifier "${token}"`)
  }

  return mapped
}

function normalizeKeyName(raw: string): string {
  const trimmed = raw.trim()

  if (trimmed.length === 0) {
    throw new Error('Shortcut key segment is empty')
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }

  const fKeyMatch = /^[Ff](\d{1,2})$/.exec(trimmed)

  if (fKeyMatch) {
    return `F${fKeyMatch[1]}`
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

/**
 * Parse an Electron-style accelerator string into a structured shortcut.
 *
 * Examples:
 * - `"CommandOrControl+C+C"` → chord=double, modifier per platform, key=C
 * - `"Ctrl+Shift+T"` → chord=single, modifiers=[ctrl, shift], key=T
 *
 * @throws {Error} When the string is malformed.
 */
export function parseQuickTranslateShortcut(
  accelerator: string,
  platform: NodeJS.Platform | string = process.platform,
): QuickTranslateShortcut {
  if (typeof accelerator !== 'string' || accelerator.trim().length === 0) {
    throw new Error('Shortcut accelerator must be a non-empty string')
  }

  const rawTokens = accelerator
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (rawTokens.length < 2) {
    throw new Error(
      'Shortcut must include at least one modifier and one key',
    )
  }

  const kind = toPlatformKind(platform)
  const modifiersOut: ShortcutModifier[] = []
  const nonModifierTokens: string[] = []

  for (const token of rawTokens) {
    if (isModifierToken(token)) {
      const mapped = mapModifier(token, kind)

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

  const keyNames = nonModifierTokens.map(normalizeKeyName)

  let chord: ShortcutChord = 'single'

  if (keyNames.length === 2) {
    if (keyNames[0] !== keyNames[1]) {
      throw new Error(
        'Chord shortcut must repeat the same key twice (e.g. C+C)',
      )
    }
    chord = 'double'
  }

  const canonicalModifiers = CANONICAL_ORDER.filter(
    (candidate) => modifiersOut.includes(candidate),
  )

  return {
    modifier: canonicalModifiers[0]!,
    modifiers: canonicalModifiers,
    key: keyNames[0]!,
    chord,
  }
}

/**
 * Lightweight validation for a stored accelerator string. Returns an empty
 * array on success, or human-readable issue messages on failure.
 */
export function validateQuickTranslateShortcut(
  accelerator: string,
  platform: NodeJS.Platform | string = process.platform,
): string[] {
  try {
    parseQuickTranslateShortcut(accelerator, platform)

    return []
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)]
  }
}

/**
 * Canonical accelerator string for a structured shortcut. The output is
 * stable per-input (canonical modifier order, uppercase key).
 */
export function formatQuickTranslateShortcut(
  shortcut: QuickTranslateShortcut,
): string {
  const modifierLabels: Record<ShortcutModifier, string> = {
    meta: 'Meta',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
  }
  const parts = shortcut.modifiers.map((mod) => modifierLabels[mod])
  parts.push(shortcut.key)

  if (shortcut.chord === 'double') {
    parts.push(shortcut.key)
  }

  return parts.join('+')
}

/**
 * Human-readable representation of the shortcut, with platform-appropriate
 * modifier glyphs (⌘ on macOS, spelled-out names elsewhere).
 */
export function formatShortcutForDisplay(
  shortcut: QuickTranslateShortcut,
  platform: NodeJS.Platform | string = process.platform,
): string {
  const kind = toPlatformKind(platform)
  const parts = shortcut.modifiers.map((mod) => DISPLAY_LABELS[mod][kind])
  parts.push(shortcut.key)

  if (shortcut.chord === 'double') {
    parts.push(shortcut.key)
  }

  return parts.join('+')
}

/**
 * Map a shortcut's `key` (e.g. `"C"`, `"F5"`) to a numeric uiohook keycode.
 * Returns `null` for unknown keys so callers can surface a friendly error
 * without throwing across IPC boundaries.
 */
export function resolveUiohookKeycode(
  key: string,
  keyMap: Readonly<Record<string, unknown>>,
): number | null {
  const candidate = keyMap[key]

  if (typeof candidate === 'number') {
    return candidate
  }

  return null
}
