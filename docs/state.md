# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 3 complete, awaiting merge)_

This file is the live status snapshot of the project. It is updated after every
development iteration. For the authoritative development plan, see
`docs/opentranslate-desktop-spec.md`, `docs/opentranslate-desktop-prd.md`,
`docs/architecture.md`, and `AGENTS.md`.

---

## Active Context

- **Current branch:** `feature/settings-secrets` (Phase 3 done, awaiting PR +
  merge into `develop`)
- **Parent branch:** `develop` (Phase 0 + Phase 1 + Phase 2 merged)
- **Last completed iteration:** Phase 3 settings store + secrets vault +
  IPC channel extensions + preload surface extensions + credential-boundary
  integration test

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
| Secret storage | **Electron `safeStorage`** (built-in; rejected keytar to avoid native dep) |
| License | MIT |

## Green-state verification (as of last verify)

- `pnpm lint` — 0 errors, 2 `security-node/detect-unhandled-async-errors`
  warnings (false positives on `electron/services/settings/store.ts` load
  function; top-level try/catch is present) + 2 non-blocking
  `boundaries/element-types` v5→v6 deprecation warnings
- `pnpm typecheck` — clean
- `pnpm test` — **64 tests passing across 12 suites**
  - `tests/unit/shared/error-mapper.test.ts` (10)
  - `tests/unit/shared/provider-config-schema.test.ts` (8)
  - `tests/unit/shared/settings-schema.test.ts` (6)
  - `tests/unit/shared/history-entry.test.ts` (4)
  - `tests/unit/shared/provider-contract.test.ts` (5)
  - `tests/unit/shared/capability-gate.test.ts` (6)
  - `tests/unit/electron/ipc-channels.test.ts` (5)
  - `tests/unit/electron/window-options.test.ts` (6)
  - `tests/unit/electron/settings-store.test.ts` (5) ← new
  - `tests/unit/electron/secrets-vault.test.ts` (5) ← new
  - `tests/unit/electron/preload-surface.test.ts` (2) ← new
  - `tests/integration/secrets-boundary.test.ts` (2) ← new
- `pnpm test:e2e` — **1 Playwright Electron smoke test passing**

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Bootstrap | **done** | pnpm, TS strict, ESLint stylistic, Vitest, Playwright, electron-builder baseline, CI matrix |
| 1 | Shared Domain | **done** | types, provider contract, Zod schemas, error mapper, DDD-lite (`ProviderReadiness`, `capability-gate`) |
| 2 | Electron Shell + Preload | **done** | Electron 41 main + preload, Nuxt 4 renderer bootstrap, typed IPC registry, manual dev wiring, Playwright smoke E2E, architecture doc pulled forward |
| 3 | Settings + Secrets Service | **done** | per-OS userData settings store (atomic write + Zod + migration), Electron `safeStorage` secrets vault, new IPC channels, preload surface asymmetry (no `secrets:get`), credential-boundary integration test |
| 4 | Provider Adapters | next | Google + LibreTranslate; per-provider `mapper.ts` ACL seam |
| 5 | Translation Orchestration | pending | debounce router, cancellation, latest-wins, language-catalog split |
| 6 | Main Translation Window | pending | two-pane DeepL-style UI, Pinia store |
| 7 | History | pending | `better-sqlite3` store, search, retention |
| 8 | Quick Translate Overlay | pending | global shortcut chord, frameless overlay |
| 9 | Documents Screen | pending | drag-drop, capability-gated |
| 10 | Settings UI + Advanced | pending | General, Shortcuts, Providers, Advanced pages |
| 11 | Packaging | pending | macOS DMG, Windows NSIS+ZIP, Linux AppImage+deb |
| 12 | Docs Hardening | pending | providers, self-hosting, packaging, security docs |

## Phase 3 delivered

- `docs/architecture.md` §7 extended with Phase 3 IPC channels
  (`settings:get`, `settings:update`, `secrets:set`, `secrets:test`) and new
  §8.1 "Settings & Credentials" section detailing storage location, atomic
  write, migration, `safeStorage` fallback policy, responsibility split, and
  error handling
- `docs/architecture.md` §8 forbidden-shortcuts list now explicitly rejects
  a `secrets:get` channel
- `shared/schemas/settings-file.ts` — `settingsFileSchema` composing
  `appSettingsSchema` + google + libretranslate schemas; `SettingsFile`
  inferred type; `defaultSettingsFile` constant; `CURRENT_SETTINGS_SCHEMA_VERSION`
- `electron/services/settings/store.ts` — `createSettingsStore({ userDataDir })`
  with `load`/`save`/`reset`; atomic write via `tmp → rename`; migration
  ladder stub; quarantines corrupted files as `settings.json.corrupted-<ts>`;
  validates updates before write
- `electron/services/secrets/vault.ts` — `createSecretsVault({ userDataDir,
  safeStorage })` with `set`/`test`/`delete`/`getMainOnly`; uses Electron
  `safeStorage.encryptString`/`decryptString`; persists encrypted cipher to
  `secrets.json`; ephemeral in-memory fallback when `safeStorage` unavailable;
  `SafeStorageLike` interface for test injection
- `electron/services/settings/handlers.ts` — pure factory
  `createSettingsAndSecretsHandlers({ store, vault })` returning typed
  handler map keyed by channel names; deliberately does NOT export a
  `secrets:get` handler
- `electron/ipc/channels.ts` — extended registry with 4 new channels;
  `ChannelContract` type-level request/response map; shape interfaces
  (`SettingsGetResponseShape`, `SecretsSetRequestShape`, etc.)
- `electron/main/index.ts` — wires the settings store + secrets vault into
  the IPC handlers at app start-up, injecting Electron's `safeStorage`
- `electron/preload/index.ts` — extended typed `window.api` surface with
  `settings.get`, `settings.update`, `secrets.set`, `secrets.test`;
  `secrets.get` intentionally absent
- `tests/unit/electron/settings-store.test.ts` — 5 tests: defaults, atomic
  write + reload, invalid-patch rejection before write, corrupted-file
  quarantine, Zod-validation fallback
- `tests/unit/electron/secrets-vault.test.ts` — 5 tests: empty presence,
  store without returning value + disk cipher check, main-only roundtrip,
  delete, ephemeral mode when `safeStorage` unavailable
- `tests/unit/electron/preload-surface.test.ts` — 2 tests: asserts preload
  source contains no `secrets:get` or `getSecret*` reference
- `tests/integration/secrets-boundary.test.ts` — 2 tests: drives the IPC
  handlers with a sensitive fixture and asserts no handler response ever
  contains the fixture bytes (raw or base64); asserts no handler key
  includes `secrets:get`

## Repository layout (current)

```
/electron
  /main            index.ts (app lifecycle + handler wiring) + window-factory.ts
  /preload         index.ts (typed contextBridge bridge)
  /ipc             channels.ts (typed channel registry)
  /services
    /settings      store.ts + handlers.ts
    /secrets       vault.ts
/app
  app.vue          Nuxt 4 root component
/shared
  /types           ...
  /schemas         settings.ts, provider-settings.ts, history-entry.ts, settings-file.ts (new)
  /providers       contract.ts
  /errors          index.ts, mapper.ts
  capability-gate.ts
/tests
  /unit
    /shared        6 suites (39 tests)
    /electron      5 suites (23 tests)
  /integration     1 suite (2 tests)
  /e2e             app-launch.e2e.ts
/docs              spec, PRD, architecture, state
/scripts           dev.mjs, build-electron.mjs
/dist-electron     (generated) main.cjs, preload.cjs, smoke.html
/build             electron-builder mac entitlements
/.github           CI workflow (matrix + xvfb on Linux)
nuxt.config.ts     at repo root, srcDir: 'app/'
.gitattributes     LF enforcement
```

## DDD-lite bounded contexts (authoritative in `docs/architecture.md`)

1. **translation** — Phase 5
2. **provider-integration** — Phase 4
3. **language-catalog** — Phase 5
4. **history** — Phase 7
5. **document-translation** — Phase 9
6. **settings-and-credentials** — **Phase 3 done** + Phase 10 (UI)
7. **quick-translate** — Phase 8

Decision: no aggregate roots, no DI container, no CQRS, no domain-event bus.
Pure functions + Zod schemas + repositories.

## Deferred items (not yet scheduled into a phase)

- ESLint `eslint-plugin-boundaries` v6 migration (`element-types` →
  `dependencies`) — currently on legacy rule name, 2 deprecation warnings only
- `security-node/detect-unhandled-async-errors` false positives on
  `electron/services/settings/store.ts` — the function is wrapped in a
  top-level try/catch but the rule is a syntactic check; 2 warnings, not
  errors

## Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Package manager: **pnpm** | user choice |
| 2 | Nuxt-Electron wiring: **manual** via `scripts/dev.mjs` + esbuild | tight control of main/preload boundary |
| 3 | History store: **better-sqlite3** | fast search, accept native rebuild cost |
| 4 | CI: **GitHub Actions**, matrix ubuntu/macos/windows, includes `test:e2e` (xvfb-wrapped on Linux) | in scope from Phase 0 |
| 5 | Node LTS: **24.x** | pinned via `.nvmrc`, engine `>=24 <25` |
| 6 | Formatter: **ESLint + @stylistic only** | Prettier removed |
| 7 | Imports: **`@shared`/`@electron`/`@app` aliases**, no `../` parent imports | enforced via `no-restricted-imports` |
| 8 | `curly: ['error', 'all']` + stylistic `max-statements-per-line: 1` | explicit multi-line block form always |
| 9 | `docs/architecture.md` is authoritative and updated each phase BEFORE code lands | prevents doc drift from code |
| 10 | Electron preload: **bundled `.cjs` via esbuild**, sandbox on | smallest blast radius |
| 11 | Dev port: **Nuxt on 3344** (strict, no fallback) | stable for E2E + Electron `ELECTRON_RENDERER_URL` |
| 12 | Smoke E2E loads `dist-electron/smoke.html` (no Nuxt build required) | fast CI without Nuxt build overhead |
| 13 | Line endings: **LF everywhere** via `.gitattributes` | Windows CI must not convert to CRLF |
| 14 | Secrets: **Electron `safeStorage`** (not keytar); ephemeral in-memory fallback when unavailable | no native compile, OS-level encryption; never write plaintext |
| 15 | Settings persisted as **Zod-validated JSON in userData dir**; atomic write + schema version + migration ladder | resilient to corruption and schema drift |
| 16 | **No `secrets:get` IPC channel**; renderer can only `set` + `test` presence | preload bridge cannot return credential material under any flow |

## Update protocol

This file must be rewritten at the end of every iteration that changes:

- phase status (pending → in progress → done)
- test count / green state
- branch context (new feature branch, merge to develop)
- locked decisions
- deferred items list
- repository layout
- Phase N sub-task checklist (tick boxes as tasks complete)

Do not leave stale state between iterations.
