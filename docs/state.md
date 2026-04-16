# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 4 complete, awaiting merge)_

This file is the live status snapshot of the project. It is updated after every
development iteration. For the authoritative development plan, see
`docs/opentranslate-desktop-spec.md`, `docs/opentranslate-desktop-prd.md`,
`docs/architecture.md`, and `AGENTS.md`.

---

## Active Context

- **Current branch:** `feature/providers` (Phase 4 done, awaiting PR +
  merge into `develop`)
- **Parent branch:** `develop` (Phase 0 + 1 + 2 + 3 merged)
- **Last completed iteration:** Phase 4 — LibreTranslate and Google Cloud
  Translation (v2 Basic) adapters wired through the plug-and-play provider
  contract, with mapper ACL seams, HTTP clients, capability probing, and
  full unit test coverage

## Environment

| Item | Value |
|---|---|
| Node | 24.x LTS (pinned via `.nvmrc`) |
| Package manager | pnpm 10.33.0 |
| Module resolution | `Bundler` (extensionless imports) |
| Path aliases | `@shared`, `@electron`, `@app` |
| Test runner | Vitest 2.1.x (unit + integration), Playwright 1.59.x (E2E) |
| Lint | ESLint 9 flat config + `@stylistic/eslint-plugin` + `eslint-plugin-sonarjs` + `eslint-plugin-boundaries` |
| Electron | 41.2.0 |
| Nuxt | 4.4.2 + `@nuxt/ui` 4.6.1 |
| HTTP runtime | undici 8.1 (main-process only) |
| Google auth | google-auth-library 10.6 |
| Secret storage | Electron `safeStorage` (built-in) |
| License | MIT |

## Green-state verification

- `pnpm lint` — 0 errors, 3 non-blocking `security-node/detect-unhandled-async-errors`
  warnings (false positives) + 2 non-blocking `boundaries/element-types`
  deprecation warnings
- `pnpm typecheck` — clean
- `pnpm test` — **127 unit + integration tests passing across 19 suites**
- `pnpm test:e2e` — **1 Playwright Electron smoke test passing**

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Bootstrap | **done** | pnpm, TS strict, ESLint stylistic, Vitest, Playwright, electron-builder baseline, CI matrix |
| 1 | Shared Domain | **done** | types, provider contract, Zod schemas, error mapper, DDD-lite |
| 2 | Electron Shell + Preload | **done** | Electron 41, Nuxt 4, typed IPC registry, smoke E2E |
| 3 | Settings + Secrets Service | **done** | safeStorage vault, atomic JSON settings, per-provider schemas, credential-boundary invariant + plug-and-play provider contract |
| 4 | Provider Adapters | **done** | LibreTranslate + Google Cloud Translation v2 Basic adapters implementing `TranslationProvider`; per-provider `mapper.ts` ACL seam; capability probing; 41 new tests |
| 5 | Translation Orchestration | next | debounce router, cancellation, latest-wins, language-catalog split |
| 6 | Main Translation Window | pending | two-pane DeepL-style UI, Pinia store |
| 7 | History | pending | `better-sqlite3` store, search, retention |
| 8 | Quick Translate Overlay | pending | global shortcut chord, frameless overlay |
| 9 | Documents Screen + Google v3 Advanced | pending | drag-drop, capability-gated, v3 document flow |
| 10 | Settings UI + Advanced | pending | generic auto-rendered provider form + General/Shortcuts/Advanced pages |
| 11 | Packaging | pending | macOS DMG, Windows NSIS+ZIP, Linux AppImage+deb |
| 12 | Docs Hardening | pending | providers, self-hosting, packaging, security |

## Phase 4 delivered

- `docs/architecture.md` §5 + new §8.2 — provider-integration context
  expanded with per-provider file layout, HTTP client pattern (undici +
  self-signed TLS toggle + AbortSignal composition), ACL mapper contracts,
  language normalization helper, capability probing rules, and
  secrets integration notes
- `shared/providers/normalize-language.ts` — pure normalizer for
  provider-native language records into canonical `Language` shape
- `shared/errors/http-mapper.ts` — `mapHttpStatusToCategory(status)` pure
  helper reused by every provider mapper
- `electron/providers/libretranslate/`
  - `mapper.ts` — native → shared mapping + `throwLibreHttpError`
  - `http-client.ts` — undici-backed client with self-signed TLS agent,
    API key injection from vault, `/languages`, `/detect`, `/translate`,
    `/frontend/settings` probe
  - `adapter.ts` — implements `TranslationProvider` contract
  - `descriptor.ts` — wires `createAdapter` to the factory
- `electron/providers/google/`
  - `auth.ts` — `GoogleAuthProvider` interface + default google-auth-library
    implementation (injectable for tests)
  - `mapper.ts` — v2 REST mapping + `throwGoogleHttpError` with
    `INVALID_ARGUMENT`/`PERMISSION_DENIED`/`RESOURCE_EXHAUSTED`/`UNAUTHENTICATED`
    disambiguation
  - `http-client.ts` — undici-backed v2 client with Bearer token auth
  - `adapter.ts` — implements `TranslationProvider`; document translation
    gated on `edition === 'advanced' && location !== null` until Phase 9
  - `descriptor.ts` — wires `createAdapter`
- `tests/unit/shared/normalize-language.test.ts` (6)
- `tests/unit/shared/http-mapper.test.ts` (7)
- `tests/unit/electron/libretranslate-mapper.test.ts` (13)
- `tests/unit/electron/libretranslate-adapter.test.ts` (10)
- `tests/unit/electron/google-mapper.test.ts` (11)
- `tests/unit/electron/google-adapter.test.ts` (7)
- ESLint: sonarjs rules added earlier (`prefer-immediate-return` + 7
  siblings); `id-length` now has `properties: 'never'` so wire-format
  short keys like `q` (URLSearchParams) are allowed at object-literal
  sites without relaxing variable-name protection; node globals
  (`Response`, `Request`, `Headers`, `FormData`, `Blob`, etc.) added

## Phase 4 deferred

- **Google Cloud Translation v3 Advanced** HTTP flows — text + detect +
  languages work on v3 identically to v2 in our usage, so v2 covers both
  editions for Phase 4. The v3 **document translation** endpoint is
  documented in §8.2 and implemented in Phase 9 when the Documents Screen
  lands.
- **Multi-field secrets vault** — the vault still stores one secret per
  provider id; the `ProviderAdapterDeps.getSecret(fieldKey)` bridge
  currently ignores `fieldKey` and returns that single value. Adequate for
  Google (no inline secret) + LibreTranslate (one `apiKey`). Future
  providers needing multiple credential fields per provider will need
  `vault.set(providerId, fieldKey, secret)` — tracked as a follow-up.

## Repository layout (current)

```
/electron
  /main            index.ts (app lifecycle + handler wiring) + window-factory.ts
  /preload         index.ts (typed contextBridge bridge)
  /ipc             channels.ts (typed channel registry)
  /services
    /settings      store.ts + handlers.ts
    /secrets       vault.ts
  /providers
    registry.ts    in-process provider registry
    index.ts       bootstrap + DTO list + barrel
    /google        descriptor.ts + adapter.ts + http-client.ts + mapper.ts + auth.ts
    /libretranslate descriptor.ts + adapter.ts + http-client.ts + mapper.ts
/app
  app.vue
/shared
  /types           domain types
  /schemas         Zod schemas
  /providers       contract + descriptor + normalize-language
  /errors          mapper + http-mapper
  capability-gate.ts
/tests
  /unit
    /shared        7 suites
    /electron      10 suites
  /integration     1 suite
  /e2e             app-launch.e2e.ts
/docs              spec, PRD, architecture, state
/scripts           dev.mjs, build-electron.mjs
```

## DDD-lite bounded contexts (authoritative in `docs/architecture.md`)

1. **translation** — Phase 5
2. **provider-integration** — **Phase 4 done** (Google + Libre shipped)
3. **language-catalog** — Phase 5
4. **history** — Phase 7
5. **document-translation** — Phase 9 (Google v3 document flow)
6. **settings-and-credentials** — Phase 3 done + Phase 10 (UI)
7. **quick-translate** — Phase 8

## Deferred items (not scheduled into a phase)

- ESLint `eslint-plugin-boundaries` v6 migration (`element-types` →
  `dependencies`) — currently on legacy rule name, 2 deprecation warnings
- `security-node/detect-unhandled-async-errors` false positives (3) on
  `settings/store.ts` + `libretranslate/http-client.ts` — top-level
  try/catch in place; rule is a syntactic check
- Multi-field secrets vault (`vault.set(providerId, fieldKey, secret)`) —
  needed if a future provider requires more than one credential field
- Google Cloud Translation v3 Advanced document translation endpoint —
  scheduled for Phase 9

## Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Package manager: **pnpm** | user choice |
| 2 | Nuxt-Electron wiring: **manual** via `scripts/dev.mjs` + esbuild | tight control of main/preload boundary |
| 3 | History store: **better-sqlite3** | fast search, accept native rebuild cost |
| 4 | CI: **GitHub Actions**, matrix ubuntu/macos/windows, xvfb on Linux | in scope from Phase 0 |
| 5 | Node LTS: **24.x** | pinned via `.nvmrc`, engine `>=24 <25` |
| 6 | Formatter: **ESLint + @stylistic only** | Prettier removed |
| 7 | Imports: **`@shared`/`@electron`/`@app` aliases**, no `../` parent imports | enforced via `no-restricted-imports` |
| 8 | `curly: ['error', 'all']` + stylistic `max-statements-per-line: 1` | explicit multi-line block form always |
| 9 | `docs/architecture.md` is authoritative and updated each phase BEFORE code lands | prevents doc drift |
| 10 | Electron preload: **bundled `.cjs` via esbuild**, sandbox on | smallest blast radius |
| 11 | Dev port: **Nuxt on 3344** | stable for E2E |
| 12 | Smoke E2E loads `dist-electron/smoke.html` | fast CI without Nuxt build |
| 13 | Line endings: **LF everywhere** via `.gitattributes` | Windows CI normalization |
| 14 | Secrets: **Electron `safeStorage`** (not keytar); ephemeral in-memory fallback | no native compile, OS-level encryption |
| 15 | Settings persisted as Zod-validated JSON with per-provider schema slices | plug-and-play provider registration |
| 16 | **No `secrets:get` IPC channel** | credentials never reach renderer |
| 17 | Provider HTTP: **undici** in the main process only | dispatcher for TLS control + consistent fetch API |
| 18 | Google auth: **google-auth-library** reading service-account JSON from `credentialsJsonPath` inside `http-client.ts`; bytes never leave main | matches §8.2 credential rules |
| 19 | Provider adapters accept **injected `fetchImpl` + `authProvider`** for testability; default to undici + google-auth-library | unit tests run pure, no network |

## Update protocol

Rewrite this file at the end of every iteration that changes phase status,
test count, branch context, locked decisions, deferred items, or layout.
