# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 10 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/settings-ui` (Phase 10 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–9 merged)
- **Last completed iteration:** Phase 10 — Settings UI with tabbed layout,
  auto-rendered provider forms from descriptors, General/Providers/Shortcuts/
  Advanced/About tabs

## Green-state verification

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — clean
- `pnpm test` — **213 tests passing across 34 suites**
- `pnpm test:e2e` — 1 passing

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0–9 | Bootstrap → Documents | **done** | |
| T | Test Hardening | **done** | |
| 10 | Settings UI | **done** | tabbed layout, auto-rendered provider forms |
| 11 | Packaging | next | |
| 12 | Docs Hardening | pending | |

## Phase 10 delivered

- `app/components/ProviderSettingsForm.vue` — auto-renders any provider's
  config form from `ProviderDescriptorDto.settingsFields` + `secretFields`.
  Handles: string/boolean/enum/number/url/file-path field types, `dependsOn`
  conditional visibility, secret presence check via `secrets:test`, password
  input for credentials. Grouped into General / Credentials / Advanced.
- `app/pages/settings.vue` — full settings page with sidebar tab navigation:
  - **General:** theme (system/light/dark), debounce ms, history toggle,
    retention mode
  - **Providers:** auto-rendered form per registered provider via
    `ProviderSettingsForm`; shows description + all fields + secret fields
  - **Shortcuts:** quick-translate shortcut string, enable/disable toggle
  - **Advanced:** request timeout, self-signed TLS toggle, reset local data
    button (stub)
  - **About:** product name, description, license
- `app/pages/index.vue` — Settings nav link added to top bar
- Settings auto-save on field change via `settings:update` IPC

## Remaining phases

| Phase | What |
|---|---|
| 11 | Packaging — electron-builder: macOS DMG, Windows NSIS+ZIP, Linux AppImage+deb |
| 12 | Docs Hardening — architecture, providers, self-hosting, packaging, security |

## Update protocol

Rewrite this file at the end of every iteration.
