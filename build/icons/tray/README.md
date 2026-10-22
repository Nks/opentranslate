# Tray icon assets

`electron/main/tray.ts` resolves the platform-correct file from this directory
at startup. The Electron `Tray` constructor only accepts a real image — the
unit test mocks the constructor, but the packaged app needs real bytes.

| Platform | File                  | Size            | Notes                                                                  |
|----------|-----------------------|-----------------|------------------------------------------------------------------------|
| macOS    | `trayTemplate@2x.png` | 44×44 px        | Template image (black + alpha only). `nativeImage.setTemplateImage` is set to `true` so the OS re-tints it per menu-bar appearance. Provide a `@1x` (22×22) variant alongside if pixel-perfect rendering on non-Retina displays matters. |
| Windows  | `tray.ico`            | multi-res `.ico`| Standard `16×16`, `24×24`, `32×32` frames; Windows picks the right one for the current DPI scale. |
| Linux    | `tray.png`            | 22×22 px        | Single colored PNG, full color. The desktop indicator renders it at its native size; provide higher DPI variants in a future ADR if needed. |

The application icon at `build/icon.png` is **not** suitable for the tray —
it is a 1024×1024 full-color brand mark. Tray glyphs must be small,
monochrome (macOS), and visually balanced against menu bars / system trays.

Design guidance:

- macOS: solid black silhouette over transparency. No anti-aliased fills
  that fight `setTemplateImage`. Apple's
  [Menu Bar guidelines](https://developer.apple.com/design/human-interface-guidelines/menu-bars/)
  govern.
- Windows: keep the silhouette readable at 16×16; avoid thin strokes that
  vanish at 100% scale.
- Linux: most StatusNotifier hosts honor full-color PNGs. Vanilla GNOME
  ships without legacy AppIndicator support — the tray will simply not
  appear on those desktops. Document this in product onboarding rather
  than trying to emulate fallback indicators.

This directory is currently empty of binary assets. Adding the icons is a
design task and is tracked separately; until they ship, the packaged
build will fall back to Electron's default empty tray bitmap.
