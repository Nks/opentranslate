# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 9 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/documents` (Phase 9 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–8 merged)
- **Last completed iteration:** Phase 9 — document translation: service,
  capability gating, IPC channels, Documents page UI, output filename convention

## Green-state verification

- `pnpm lint` — 0 errors, 0 warnings
- `pnpm typecheck` — clean
- `pnpm test` — **213 tests passing across 34 suites**
- `pnpm test:e2e` — 1 passing

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0–8 | Bootstrap → Quick Translate | **done** | |
| T | Test Hardening | **done** | |
| 9 | Documents Screen | **done** | service, capability gate, IPC, UI, output naming |
| 10 | Settings UI | next | |
| 11 | Packaging | pending | |
| 12 | Docs Hardening | pending | |

## Phase 9 delivered

- `docs/architecture.md` §8.7 — capability gating rules, file handling flow,
  output naming convention, 3 IPC channel specs
- `electron/services/documents/service.ts` — `createDocumentService` with
  `translate` (validates adapter + capability → delegates to
  `adapter.translateDocument`), `isSupported`, `buildOutputPath`
  (`<name>.<target>.translated<ext>`)
- `electron/ipc/channels.ts` — 3 new channels: `document:pick`,
  `document:translate`, `document:status` with typed contracts
- `app/pages/documents.vue` — capability status banner, drop zone / file
  picker, translate button, output path display with copy, error panel,
  nav from main page top bar
- `app/pages/index.vue` — Documents nav link added to top bar
- `tests/unit/electron/document-service.test.ts` (6 tests) — output filename
  convention (3), no-adapter error, unsupported-provider error, isSupported
  false when no adapter

## Update protocol

Rewrite this file at the end of every iteration.
