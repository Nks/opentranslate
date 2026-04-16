# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 5 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/translation-core` (Phase 5 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–4 + test hardening merged)
- **Last completed iteration:** Phase 5 — translation orchestration service
  (debounce-owner = renderer, cancel via AbortController + signal.aborted
  check, latest-wins via monotonic sequence), language-catalog service
  (per-provider cache + revalidateSelection pure fn), 5 new IPC channels

## Green-state verification

- `pnpm lint` — 0 errors, 3 non-blocking warnings
- `pnpm typecheck` — clean
- `pnpm test` — **162 tests passing across 22 suites** (+16 from Phase 4 test hardening)
- `pnpm test:e2e` — 1 passing

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Bootstrap | **done** | |
| 1 | Shared Domain | **done** | |
| 2 | Electron Shell + Preload | **done** | |
| 3 | Settings + Secrets + Provider Contract | **done** | |
| 4 | Provider Adapters | **done** | |
| T | Test Hardening | **done** | 79% → 90%+ coverage |
| 5 | Translation Orchestration | **done** | orchestrator + language catalog + IPC channels |
| 6 | Main Translation Window | next | two-pane DeepL-style UI, Pinia store |
| 7 | History | pending | |
| 8 | Quick Translate Overlay | pending | |
| 9 | Documents Screen + Google v3 | pending | |
| 10 | Settings UI | pending | |
| 11 | Packaging | pending | |
| 12 | Docs Hardening | pending | |

## Phase 5 delivered

- `docs/architecture.md` §8.3 — translation orchestration + language catalog
  context, debounce ownership (renderer-side), cancel + latest-wins mechanics,
  provider-switch flow, 5 new IPC channel specs
- `electron/services/language-catalog/catalog.ts` — in-memory per-provider
  language cache with `refreshLanguages`, `getLanguages`,
  `revalidateSelection` (pure fn: resets invalid source to auto, invalid
  target to first-available)
- `electron/services/translation/orchestrator.ts` — `translate` (cancel
  prior in-flight via AbortController, latest-wins via sequence counter +
  signal.aborted check), `detect`, `cancel`, `setAdapter`/`getAdapter`
- `electron/ipc/channels.ts` — 5 new channels: `translation:translate`,
  `translation:cancel`, `translation:detect`, `provider:switch`,
  `language:list` with full typed contracts
- `tests/unit/electron/language-catalog.test.ts` (9 tests)
- `tests/unit/electron/translation-orchestrator.test.ts` (7 tests)

## Deferred from Phase 5

- **Full provider:switch handler wiring** in `main/index.ts` — requires
  connecting the orchestrator to the provider registry + settings store +
  secrets vault to create an adapter at runtime; this is the "activate a
  provider" flow. Slots into Phase 6 when the UI triggers it, or into a
  Phase 5b follow-up.
- **Preload surface extension** for Phase 5 channels — the channel contracts
  are typed; preload methods land when the handlers are wired.

## Update protocol

Rewrite this file at the end of every iteration that changes phase status,
test count, branch context, locked decisions, deferred items, or layout.
