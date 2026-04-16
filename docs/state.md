# Project State — OpenTranslate Desktop

_Last updated: 2026-04-16 (Phase 11 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/packaging` (Phase 11 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–10 merged)
- **Last completed iteration:** Phase 11 — Packaging with electron-builder,
  CI release workflow, build scripts, app icon

## Green-state verification

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — clean
- `pnpm test` — **251 tests passing across 37 suites**
- `pnpm test:e2e` — 1 passing
- `pnpm package:dir` — verified: macOS arm64 app bundle builds successfully

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0–9 | Bootstrap → Documents | **done** | |
| T | Test Hardening | **done** | |
| 10 | Settings UI | **done** | tabbed layout, auto-rendered provider forms |
| 11 | Packaging | **done** | electron-builder, release CI, scripts, icon |
| 12 | Docs Hardening | next | |

## Phase 11 delivered

- `scripts/package.mjs` — orchestrates build:electron → build:renderer →
  electron-builder. Supports `--dir` flag for unpacked output.
- `package.json` updates:
  - `"main": "dist-electron/main.cjs"` — electron-builder entry point
  - `"version": "0.1.0"` — first release milestone
  - `"package"` script now runs real packaging (was stub)
  - `"package:dir"` script for unpacked output inspection
  - `yaml` devDependency for config tests
- `build/icon.png` — 1024x1024 placeholder app icon (teal circle)
- `.github/workflows/release.yml` — CI release workflow:
  - Triggers on `v*` tags pushed to main
  - Matrix build: macOS, Windows, Linux
  - Runs lint + typecheck + tests before packaging
  - Uploads artifacts to GitHub Release (draft)
- `docs/architecture.md` — Section 11 added: packaging pipeline, platform
  targets, native modules, code signing, build resources, CI release
- `electron-builder.yml` — no changes needed (already correct from Phase 0)
- Tests:
  - `tests/unit/packaging/electron-builder-config.test.ts` (19 tests)
  - `tests/unit/packaging/release-workflow.test.ts` (9 tests)
  - `tests/unit/packaging/package-script.test.ts` (10 tests)

## Remaining phases

| Phase | What |
|---|---|
| 12 | Docs Hardening — architecture, providers, self-hosting, packaging, security |

## Update protocol

Rewrite this file at the end of every iteration.
