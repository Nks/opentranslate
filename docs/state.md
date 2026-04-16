# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Test hardening complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/test-hardening` (done, awaiting PR + merge)
- **Parent branch:** `develop` (Phase 0–4 merged)
- **Last completed iteration:** Test hardening — coverage 79% → 90%+,
  17 new tests, type-only files excluded from report

## Green-state verification

- `pnpm lint` — 0 errors, 3 non-blocking warnings
- `pnpm typecheck` — clean
- `pnpm test` — **146 tests passing across 20 suites** (+19 from Phase 4)
- `pnpm test:e2e` — 1 passing
- **Coverage: 90.22% stmts, 87.71% branch, 94.5% funcs**

## Coverage summary (runtime files only)

| Area | Stmts | Notes |
|---|---|---|
| electron/ipc/* | 100% | |
| electron/main/window-factory | 100% | |
| electron/providers/registry | 100% | |
| electron/providers/google/adapter | 94% | |
| electron/providers/google/auth | 5% | real GCP bridge; tests inject fakes — expected |
| electron/providers/google/http-client | 94% | |
| electron/providers/google/mapper | 86% | remaining: reflection + deep error-extraction edges |
| electron/providers/libretranslate/* | 81–100% | |
| electron/services/http/provider-http | 87% | AbortSignal.any reflection branch |
| electron/services/secrets/vault | 90% | |
| electron/services/settings/* | 89–100% | |
| shared/* | 87–100% | |

**Excluded from coverage report:** `shared/types/*.ts` (pure interfaces),
`shared/index.ts`, `shared/providers/contract.ts` (type re-exports),
`electron/main/index.ts`, `electron/preload/index.ts` (Electron runtime —
covered by Playwright E2E).

## Test hardening delivered

- `tests/unit/electron/provider-http.test.ts` (8 tests) — direct kernel
  tests: GET/POST, auth header injection, network error wrapping,
  errorMapper delegation with JSON + text-fallback body, composeAbortSignal,
  stripTrailingSlash
- `tests/unit/electron/google-mapper.test.ts` — 5 new tests:
  INVALID_ARGUMENT without language keyword, null body, empty error object,
  401 UNAUTHENTICATED, 429
- `tests/unit/electron/google-adapter.test.ts` — 2 new tests:
  getCapabilities all-flags, health-fail path
- `tests/unit/electron/settings-store.test.ts` — 2 new tests: reset(),
  unexpected-fs-error catch-all
- `vitest.config.ts` coverage exclude updated

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Bootstrap | **done** | |
| 1 | Shared Domain | **done** | |
| 2 | Electron Shell + Preload | **done** | |
| 3 | Settings + Secrets + Provider Contract | **done** | |
| 4 | Provider Adapters | **done** | |
| T | Test Hardening | **done** | 79% → 90%+ coverage |
| 5 | Translation Orchestration | next | debounce, cancel, latest-wins, language-catalog |
| 6 | Main Translation Window | pending | |
| 7 | History | pending | |
| 8 | Quick Translate Overlay | pending | |
| 9 | Documents Screen + Google v3 | pending | |
| 10 | Settings UI | pending | |
| 11 | Packaging | pending | |
| 12 | Docs Hardening | pending | |

## Update protocol

Rewrite this file at the end of every iteration that changes phase status,
test count, branch context, locked decisions, deferred items, or layout.
