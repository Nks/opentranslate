# Changelog

All notable changes to **OpenTranslate Desktop** are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`0.1.x` is the first public alpha and is published as a **GitHub pre-release**.
The macOS app is ad-hoc signed (not notarized) and the Windows installer is
unsigned; see [`docs/install.md`](docs/install.md) for the Gatekeeper /
SmartScreen first-open steps.

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
