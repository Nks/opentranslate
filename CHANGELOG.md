# Changelog

All notable changes to **OpenTranslate Desktop** are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`0.1.x` is the first public alpha and is published as a **GitHub pre-release**.
The macOS app is ad-hoc signed (not notarized) and the Windows installer is
unsigned; see [`docs/install.md`](docs/install.md) for the Gatekeeper /
SmartScreen first-open steps.

---

## [Unreleased]

### Added

- **LibreTranslate document translation.** On deployments that enable file
  translation, the Documents page lists the server's supported formats
  (`.txt`, `.docx`, `.pdf`, … as reported by `/frontend/settings`), uploads
  the picked file and saves the result unmodified next to it as
  `<name>.<target>.translated<ext>`. Files the deployment does not support
  are rejected before upload with a message listing the supported formats.
  Files are capped at 50 MiB up and 100 MiB down; the picker filters by the
  server's formats.
- **Rebuilt Documents page.** It now has the provider selector and the
  source (with Auto Detect) and target language selectors from the main
  window, a capability panel listing the server's formats, real
  drag-and-drop anywhere on the page next to the **Choose file** button, a
  progress state while translating, **Show in folder** and **Copy path** for
  the result, and an error panel with the error category and copyable
  details. Switching provider re-checks document support.

### Fixed

- **Documents page failed with "Document translation not yet implemented".**
  The capability check reported LibreTranslate documents as available while
  the translate action was a stub; the action is now wired end to end.
- **Errors from the main process showed the generic "Something went wrong"
  text.** The preload `[channel]` prefix stopped the error formatter from
  reading the error category; the Documents page and the translator now
  show the categorized message (for example "This file type is not
  supported for translation. Supported formats: …").

### Changed

- **Provider requests no longer follow HTTP redirects.** A redirecting
  endpoint (for example `http://` → `https://`) now fails with "endpoint
  answered with a redirect"; enter the final URL in Settings. This keeps the
  LibreTranslate API key from being re-sent to another host on a 307/308.
- An unreachable endpoint, TLS or authentication problem on the Documents
  page now shows that error instead of "not supported".

### Security

- The translated file is downloaded only from the configured LibreTranslate
  `http(s)` origin, without the API key.
- Provider responses are size-limited: JSON 1 MiB, error bodies 64 KiB,
  downloads 100 MiB; server error text is shortened to 200 characters.
- Translated files carry Mark-of-the-Web (Windows `Zone.Identifier`), so
  Office/Explorer treat them as downloaded. On macOS the app is now
  quarantine-enabled: every file it creates (translated documents and its
  own settings/history files) gets `com.apple.quarantine`.
- A selected document is opened once and checked and read through the same
  handle; it can only be translated with the provider that was active when
  it was picked or dropped.
- Only the file picked in the native dialog or dropped on the page can be
  translated (the dropped file's path is resolved in preload, never sent by
  the page); network (UNC) paths, non-regular files and oversized files are
  refused, and the result is written atomically without following a
  symlink at the output path. **Show in folder** reveals only the file the
  app just wrote.

---

## [0.1.1] — 2026-10-23

### Fixed

- **macOS DMG reported as damaged ("OpenTranslate Desktop is damaged and
  can't be opened"); the app bundle is now ad-hoc signed.** Its code
  signature seals `Info.plist` and every resource, so a downloaded
  (quarantined) app gets macOS's regular first-open prompt for apps that
  are not notarized, with **Open Anyway** in System Settings → Privacy &
  Security, instead of being reported as damaged. Packaging fails if `codesign --verify --deep
  --strict` rejects the bundle. First-open steps for macOS and Windows are
  in [`docs/install.md`](docs/install.md).

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
- **Four unsigned platform targets** — macOS arm64 and macOS x64 (`.dmg`
  each), Windows x64 (NSIS installer + portable `.zip`) and Linux x64
  (AppImage + `.deb`). Every artifact name carries its arch
  (`opentranslate-desktop-<ver>-<os>-<arch>`), each target is built on a
  native CI runner, its native binaries are verified against the target
  arch, and the packaged app is smoke-tested before the draft pre-release
  is assembled with `SHA256SUMS.txt`.
- **Strict security posture** — `contextIsolation` on, `nodeIntegration`
  off, no `secrets:get` IPC channel exists or will exist, Content Security
  Policy locked down in the main process, logs redact secrets and (by
  default) translation content, no telemetry, no cloud sync. See
  [`docs/threat-model.md`](docs/threat-model.md).

### Dependencies

- Electron 44.9.3, electron-builder 26.15.3, Nuxt 4.6, Nuxt UI 4.11,
  Pinia 4, VueUse 15, Vitest 5, ESLint 10, TypeScript 6.0, pnpm 10.34.
- Every dependency, direct and transitive, is at least 7 days old
  (pnpm `minimumReleaseAge`, matching the Dependabot cooldown), except the
  Electron 44 patch line, which takes Chromium/V8 security backports
  immediately; new Electron majors still wait.
- Only the unbundled native modules (`better-sqlite3`, `uiohook-napi`)
  remain runtime `dependencies`; everything esbuild or Nuxt bundles is a
  `devDependency`.
- `better-sqlite3` 13 and `uiohook-napi` load N-API prebuilds; installs and
  packaging no longer rebuild native modules, and each installer carries
  only its own platform-arch binary.

### Security

- IPC errors crossing `safeHandler` no longer chain the raw provider error
  as `cause`, so response bodies, stacks and paths stay in the main
  process.
- `pnpm audit`, Trivy and the license check cover the full dependency tree
  (shipped code is bundled from `devDependencies`); remaining
  unpatchable, build-time-only advisories and license exclusions are
  documented in [`docs/security.md`](docs/security.md).
- Dependabot/Trivy advisories on transitive packages cleared by the
  dependency refresh; `handlebars` pinned to the patched 4.7.10.
- GitHub Actions pinned to commit SHAs, read-only default token,
  `persist-credentials: false`, no dependency cache in release builds,
  job timeouts, no expression interpolation in scripts.
- Every installer and `SHA256SUMS.txt` carries a build-provenance
  attestation (`gh attestation verify`); the release job never modifies an
  already-published release.

### Known limitations

- Unsigned binaries on macOS and Windows. macOS Gatekeeper and Windows
  SmartScreen will refuse first launch by default; see
  [`docs/install.md`](docs/install.md) for the manual bypass.
- No auto-update — new releases must be downloaded manually from the
  GitHub releases page.
- No Linux arm64 or Windows arm64 build. Linux arm64 is blocked by an
  upstream `uiohook-napi` prebuild (**B-059** in
  [`docs/backlog.md`](docs/backlog.md)).
- Google document translation reports `documentTranslation: false`; the
  v3 docs flow is stubbed and intentionally disabled for `0.1.0`.
- The macOS menubar tray icon is the auto-generated black-on-alpha
  template. A hand-drawn replacement is tracked as **B-G-18** for
  `0.1.1`.
- LibreTranslate document translation is gated by the deployment's
  capability response. Self-hosted instances vary; the UI follows the
  reported capability and disables the document tab when unsupported.

[0.1.1]: https://github.com/Nks/opentranslate/releases/tag/v0.1.1
[0.1.0]: https://github.com/Nks/opentranslate/releases/tag/v0.1.0
