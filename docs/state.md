# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 8 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/quick-translate` (Phase 8 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–7 merged)
- **Last completed iteration:** Phase 8 — quick translate overlay: chord
  detector, frameless overlay window, quick translate service, overlay page UI

## Green-state verification

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — clean
- `pnpm test` — **207 tests passing across 33 suites**
- `pnpm test:e2e` — 1 passing

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0–7 | Bootstrap → History | **done** | |
| T | Test Hardening | **done** | |
| 8 | Quick Translate Overlay | **done** | chord detector, overlay window, service, UI |
| 9 | Documents Screen + Google v3 | next | |
| 10 | Settings UI | pending | |
| 11 | Packaging | pending | |
| 12 | Docs Hardening | pending | |

## Phase 8 delivered

- `docs/architecture.md` §8.6 — chord detection mechanics, clipboard read
  policy, overlay window spec, IPC channels, overlay UI spec
- `electron/services/shortcuts/chord-detector.ts` — double-tap detector
  with configurable window (default 500ms); fires only on second press
  within window; first press passes through to OS copy
- `electron/main/overlay-window.ts` — pure factory for frameless,
  always-on-top, sandboxed overlay `BrowserWindow` options (480×320,
  centered, skip taskbar, same security as main window)
- `electron/services/quick-translate/service.ts` — reads clipboard text,
  trims, translates via orchestrator, returns structured result with
  source/translated/detected-lang/target/provider
- `app/pages/overlay.vue` — compact card: header with lang pair + provider,
  translated text body, footer with Copy/Open Full/Close buttons, Esc
  keyboard listener, draggable header region
- `tests/unit/electron/chord-detector.test.ts` (5 tests) — double-tap,
  single-tap no-fire, outside-window no-fire, reset, re-trigger
- `tests/unit/electron/overlay-window.test.ts` (6 tests) — security
  invariants (frameless, alwaysOnTop, skipTaskbar, contextIsolation,
  nodeIntegration off, compact dimensions)
- `tests/unit/electron/quick-translate.test.ts` (3 tests) — translate +
  result shape, empty clipboard returns null, whitespace trimming

## Update protocol

Rewrite this file at the end of every iteration.
