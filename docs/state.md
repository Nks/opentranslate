# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 2 complete, awaiting merge)_

This file is the live status snapshot of the project. It is updated after every
development iteration. For the authoritative development plan, see
`docs/opentranslate-desktop-spec.md`, `docs/opentranslate-desktop-prd.md`,
`docs/architecture.md`, and `AGENTS.md`.

---

## Active Context

- **Current branch:** `feature/electron-shell` (Phase 2 done, awaiting PR +
  merge into `develop`)
- **Parent branch:** `develop` (Phase 0 + Phase 1 merged)
- **Last completed iteration:** Phase 2 Electron shell + preload bridge +
  Nuxt 4 renderer bootstrap + Playwright smoke E2E

## Environment

| Item | Value |
|---|---|
| Node | 24.x LTS (pinned via `.nvmrc`) |
| Package manager | pnpm 10.33.0 |
| Module resolution | `Bundler` (extensionless imports) |
| Path aliases | `@shared`, `@electron`, `@app` |
| Test runner | Vitest 2.1.x (unit + integration), Playwright 1.59.x (E2E) |
| Lint | ESLint 9 flat config + `@stylistic/eslint-plugin` (Prettier removed) |
| Electron | 41.2.0 |
| Nuxt | 4.4.2 + `@nuxt/ui` 4.6.1 |
| License | MIT |

## Green-state verification (as of last verify)

- `pnpm lint` — clean (only non-blocking `boundaries/element-types` v5→v6
  deprecation warnings)
- `pnpm typecheck` — clean
- `pnpm test` — **50 unit tests passing across 8 suites**
  - `tests/unit/shared/error-mapper.test.ts` (10)
  - `tests/unit/shared/provider-config-schema.test.ts` (8)
  - `tests/unit/shared/settings-schema.test.ts` (6)
  - `tests/unit/shared/history-entry.test.ts` (4)
  - `tests/unit/shared/provider-contract.test.ts` (5)
  - `tests/unit/shared/capability-gate.test.ts` (6)
  - `tests/unit/electron/ipc-channels.test.ts` (5)
  - `tests/unit/electron/window-options.test.ts` (6)
- `pnpm test:e2e` — **1 Playwright Electron smoke test passing**
  - `tests/e2e/app-launch.e2e.ts` — launches Electron, verifies
    `contextIsolation`/`nodeIntegration`/sandbox invariants at runtime,
    round-trips `app:get-version` + `app:get-platform` through preload bridge

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Bootstrap | **done** | pnpm, TS strict, ESLint stylistic, Vitest, Playwright, electron-builder baseline, CI matrix |
| 1 | Shared Domain | **done** | types, provider contract, Zod schemas, error mapper, DDD-lite (`ProviderReadiness`, `capability-gate`) |
| 2 | Electron Shell + Preload | **done** | Electron 41 main + preload, Nuxt 4 renderer bootstrap, typed IPC registry, manual dev wiring, Playwright smoke E2E, architecture doc pulled forward |
| 3 | Settings + Secrets Service | next | per-OS userData store + keytar-backed secret vault |
| 4 | Provider Adapters | pending | Google + LibreTranslate; per-provider `mapper.ts` ACL seam |
| 5 | Translation Orchestration | pending | debounce router, cancellation, latest-wins, language-catalog split |
| 6 | Main Translation Window | pending | two-pane DeepL-style UI, Pinia store |
| 7 | History | pending | `better-sqlite3` store, search, retention |
| 8 | Quick Translate Overlay | pending | global shortcut chord, frameless overlay |
| 9 | Documents Screen | pending | drag-drop, capability-gated |
| 10 | Settings UI + Advanced | pending | General, Shortcuts, Providers, Advanced pages |
| 11 | Packaging | pending | macOS DMG, Windows NSIS+ZIP, Linux AppImage+deb |
| 12 | Docs Hardening | pending | providers, self-hosting, packaging, security (architecture.md already lives + updated each phase) |

## Phase 2 delivered

- `docs/architecture.md` — authoritative DDD-lite reference (pulled forward;
  updated in every subsequent phase before code lands)
- `electron/ipc/channels.ts` — typed channel registry with `app:get-version`
  and `app:get-platform` baseline channels; `ChannelContract` type-level
  request/response map
- `electron/main/window-factory.ts` — pure `createWindowOptions({preloadPath})`
  factory producing `BrowserWindow` config with `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- `electron/main/index.ts` — app lifecycle, single-instance lock, IPC handler
  registration, dev/smoke/prod renderer loading
- `electron/preload/index.ts` — typed `contextBridge.exposeInMainWorld('api',
  {...})` with channel whitelist; exports `OpenTranslateApi` type
- `app/app.vue` + `nuxt.config.ts` — minimal Nuxt 4 renderer with Nuxt UI
  registered, SSR disabled, `srcDir: app/`, strict TypeScript
- `scripts/dev.mjs` — manual dev orchestrator (esbuild watch + Nuxt dev on
  port 3344 + Electron launch with `ELECTRON_RENDERER_URL`)
- `scripts/build-electron.mjs` — production bundle of main.cjs + preload.cjs
  + smoke.html via esbuild
- `.github/workflows/ci.yml` — CI now runs `pnpm test:e2e` on the matrix
- `tests/unit/electron/window-options.test.ts` — 6 security-invariant unit
  tests
- `tests/unit/electron/ipc-channels.test.ts` — 5 channel registry unit tests
- `tests/e2e/app-launch.e2e.ts` — Playwright Electron smoke test verifying
  launch, security, and preload round-trip
- ESLint: vue-eslint-parser installed for `.vue` files; `NodeJS` global added

## Repository layout (current)

```
/electron
  /main            index.ts (app lifecycle) + window-factory.ts (pure options)
  /preload         index.ts (typed contextBridge bridge)
  /ipc             channels.ts (typed channel registry)
/app
  app.vue          Nuxt 4 root component (Nuxt UI)
/shared            types, providers/contract, errors, schemas, capability-gate
/tests
  /unit
    /shared        6 suites (39 tests)
    /electron      2 suites (11 tests)
  /e2e             app-launch.e2e.ts (1 smoke test)
/docs              spec, PRD, architecture, state
/scripts           dev.mjs, build-electron.mjs
/dist-electron     (generated) main.cjs, preload.cjs, smoke.html
/build             electron-builder mac entitlements
/.github           CI workflow (matrix ubuntu/macos/windows)
nuxt.config.ts     at repo root, srcDir: 'app/'
```

## DDD-lite bounded contexts (authoritative in `docs/architecture.md`)

1. **translation** — Phase 5
2. **provider-integration** — Phase 4
3. **language-catalog** — Phase 5
4. **history** — Phase 7
5. **document-translation** — Phase 9
6. **settings-and-credentials** — Phase 3 + Phase 10 (UI)
7. **quick-translate** — Phase 8

Decision: no aggregate roots, no DI container, no CQRS, no domain-event bus.
Pure functions + Zod schemas + repositories.

## Deferred items (not yet scheduled into a phase)

- ESLint `eslint-plugin-boundaries` v6 migration (`element-types` →
  `dependencies`) — currently on legacy rule name, 2 deprecation warnings only
- CI may need Playwright browser install step for Linux (`pnpm exec playwright
  install-deps` + `--with-deps`) — currently only Electron runs; revisit if
  CI red

## Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Package manager: **pnpm** | user choice |
| 2 | Nuxt-Electron wiring: **manual** via `scripts/dev.mjs` + esbuild | tight control of main/preload boundary |
| 3 | History store: **better-sqlite3** | fast search, accept native rebuild cost |
| 4 | CI: **GitHub Actions**, matrix ubuntu/macos/windows, includes `test:e2e` | in scope from Phase 0 |
| 5 | Node LTS: **24.x** | pinned via `.nvmrc`, engine `>=24 <25` |
| 6 | Formatter: **ESLint + @stylistic only** | Prettier removed |
| 7 | Imports: **`@shared`/`@electron`/`@app` aliases**, no `../` parent imports | enforced via `no-restricted-imports` |
| 8 | `curly: ['error', 'all']` + stylistic `max-statements-per-line: 1` | explicit multi-line block form always |
| 9 | `docs/architecture.md` is authoritative and updated each phase BEFORE code lands | prevents doc drift from code |
| 10 | Electron preload: **bundled `.cjs` via esbuild**, sandbox on | smallest blast radius |
| 11 | Dev port: **Nuxt on 3344** (strict, no fallback) | stable for E2E + Electron `ELECTRON_RENDERER_URL` |
| 12 | Smoke E2E loads `dist-electron/smoke.html` (no Nuxt build required) | fast CI without Nuxt build overhead |

## Update protocol

This file must be rewritten at the end of every iteration that changes:

- phase status (pending → in progress → done)
- test count / green state
- branch context (new feature branch, merge to develop)
- locked decisions
- deferred items list
- repository layout
- Phase N sub-task checklist (when the active phase has one)

Do not leave stale state between iterations.
