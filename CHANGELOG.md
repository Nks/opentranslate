# Changelog

All notable changes to **OpenTranslate Desktop** are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`0.1.0` is the first public alpha and is published as a **GitHub pre-release**.
Binaries are unsigned on macOS and Windows; see
[`docs/install.md`](docs/install.md) for Gatekeeper / SmartScreen bypass
instructions.

---

## [0.1.0] — 2026-05-18

### Highlights

- **Translation providers** — Google Cloud Translation and LibreTranslate,
  swappable at runtime. Capability-gated; document translation is reported
  as unsupported in API-key mode and is not yet wired end-to-end.
- **Two-pane translator UI** — source and target text panes, language pickers
  with auto-detect on the source side, swap button, and a Copy action with
  inline confirmation feedback.
- **Quick-translate shortcut** — a configurable global keyboard chord opens
  an overlay window above the current foreground app. The clipboard is read
  only at the moment the chord fires.
- **Local history** — SQLite-backed via `better-sqlite3`. Per-entry copy /
  open / delete, full-text search, clear-all, and a per-settings toggle to
  disable history capture entirely.
- **Provider switching** — per-provider settings forms, secret round-trip via
  Electron `safeStorage`, and a connection test for each adapter. Google
  exposes a file picker for service-account JSON **or** a plain API key text
  field; LibreTranslate takes a configurable endpoint with an optional
  API key.
- **System tray / menu bar** — tray icon with Open, Quick Translate, and
  Quit. First close of the main window asks whether to hide-to-tray or
  quit, with a "Remember choice" checkbox that persists the answer.
- **Cross-platform unsigned builds** — macOS (`.dmg`, x64 + arm64),
  Windows (NSIS installer + portable `.zip`, x64), and Linux (AppImage +
  `.deb`, x64).
- **Strict security posture** — `contextIsolation` on, `nodeIntegration`
  off, no `secrets:get` IPC channel exists or will exist, Content Security
  Policy locked down in the main process, logs redact secrets and (by
  default) translation content, no telemetry, no cloud sync. See
  [`docs/threat-model.md`](docs/threat-model.md).

### Known limitations

- Unsigned binaries on macOS and Windows. macOS Gatekeeper and Windows
  SmartScreen will refuse first launch by default; see
  [`docs/install.md`](docs/install.md) for the manual bypass.
- No auto-update — new releases must be downloaded manually from the
  GitHub releases page.
- Google document translation reports `documentTranslation: false`; the
  v3 docs flow is stubbed and intentionally disabled for `0.1.0`.
- The macOS menubar tray icon is the auto-generated black-on-alpha
  template. A hand-drawn replacement is tracked as **B-G-18** for
  `0.1.1`.
- LibreTranslate document translation is gated by the deployment's
  capability response. Self-hosted instances vary; the UI follows the
  reported capability and disables the document tab when unsupported.

[0.1.0]: https://github.com/Nks/opentranslate/releases/tag/v0.1.0
