# Project State — OpenTranslate Desktop

_Last updated: 2026-04-28 (P0 fix; B-010 in flight)_

---

## Active context

- **Current branch:** `fix/b-010-history-recording` (PR pending)
- **Parent branch:** `develop`
- **In-flight commit:** `a3b47a3 — fix(b-010): surface history-store failures instead of silently dropping writes`
- **Last completed iteration:** Bundle (B-049) — `fix(b-049): prevent identical source + target language selection` merged as `922afe9`

## Green-state verification

- `pnpm lint` — clean (`@stylistic` + `@typescript-eslint` strict)
- `pnpm typecheck` — clean
- `pnpm test` — **405 tests across 59 suites**
- `pnpm test:e2e` — see CI matrix (Linux xvfb, macOS, Windows)

## Recently merged (chronological, post-Phase 12)

| Hash | PR | Summary |
|---|---|---|
| `922afe9` | #39 | B-049 — same-language pair swap (`applySourceChange` / `applyTargetChange` helpers); state.md + backlog grooming + priority audit |
| `7d7c284` | #38 | B-026 + B-042 — Copy/Copied feedback + friendly translation errors with Show details / Copy panel |
| `a8007e9` | #27 | B-007 + B-037 + B-038 — home-screen provider gating, empty-language guard; settings ↔ store sync via `useSettingsPage`; security CI (CodeQL, Dependabot, Trivy, Semgrep, gitleaks, license-check) |
| `80bba6b` | #21 | B-001 + B-003 + B-006 + B-008 — provider bootstrap, empty state, capability-gated UI, first-capable-target fallback |
| `243aa6d` | #22 | B-004 — persisted active-provider selection (structured `ActiveProviderSelection`, store hydrate/migrate) |
| `3cca1ba` | #23 | B-015 — reset-data confirmation modal + `settings:reset` IPC |
| `7a756e5` | #24 | B-016 + B-034 — shortcut recorder + platform-aware default accelerator |
| `c8c5b48` | #26 | B-028 — drop DeepL brand references; rename to "two-pane translator" |

## In flight (this PR)

- **B-010** — History not writing (P0).
  - `electron/services/history/handlers.ts`: type `history:add` honestly
    as `async (input) => Promise<HistoryEntry | null>`; drop the
    `as unknown as HistoryEntry | null` cast.
  - `electron/main/ipc-setup.ts`: replace silent `?? null` fallback for
    every history channel with `requireHistoryHandlers()` that throws a
    clear actionable message when better-sqlite3 init failed (most
    likely native-ABI mismatch). Renderer's `useHandleError` toasts the
    error instead of the user seeing empty history.
  - `tests/unit/electron/history-handlers.test.ts`: 4 specs cover the
    round-trip with a real settings + history store, the
    `historyEnabled = false` short-circuit, the Promise-instance
    assertion, and the fresh-store default-on smoke.

## Architecture snapshot

- **Renderer (Nuxt 4 + Nuxt UI):** `app/pages/index.vue` orchestrates;
  `TopBar` / `TranslationInput` / `TranslationOutput` / `StatusBar` /
  `ProviderErrorBanner` / `EmptyProviderState` / `LanguageSelector`
  components. Pinia stores: `providers` (with
  `currentSelection`/`hydrateFromSelection`/`activeDescriptors`/`canTranslate`),
  `translation` (with `error` + `errorDetail`), `settings`, `history`.
- **Composables:** `useApi` (singleton, hoisted once),
  `useTranslation` (debounced translate + capability-gated switch +
  reconcile + persist), `useSelectionPersistence`,
  `useSelectionReconcile`, `useProviderBootstrap` (auto-select first
  enabled), `useSettingsPage` (drives `providersStore.providerSettings`
  directly), `useResetLocalData`, `useHandleError`, `useHistory`.
- **Shared:** typed IPC channels, Zod settings schema with
  `ActiveProviderSelection`, `AppError` + `ErrorCategory`,
  `formatErrorMessage` (renderer-side), `quick-translate` shortcut
  parser, `language-pair` swap helpers.
- **Electron main:** `ipc-setup` registers settings/secrets/translation/
  history/document/quick-translate channels through `safeHandler`;
  `QuickTranslateController` listens via `uiohook-napi`; settings
  store persists through atomic write + quarantine +
  `migrateActiveProvider`; history handlers gated by
  `requireHistoryHandlers` so sqlite-init failures surface as toasts.

## Security / CI scaffolding

- `.github/workflows/codeql.yml` — JS/TS SAST, push + PR + weekly cron,
  CodeQL Action `@v4`.
- `.github/workflows/security-scan.yml` — `pnpm audit --prod`, Trivy
  (`@master`, deps + IaC + secrets), Semgrep (Docker, security-audit /
  javascript / typescript / secrets / owasp-top-ten), license-checker
  (MIT/Apache/BSD/ISC/CC0/BlueOak whitelist), gitleaks full history.
- `.github/dependabot.yml` — weekly npm + github-actions, grouped by
  ecosystem (electron / nuxt / vueuse / eslint / vitest / types).
- Repo-side actions still required: enable Dependabot alerts +
  security updates, Secret scanning + Push protection, branch
  protection rules on `develop`/`main`.

## Backlog snapshot

Open items live in `docs/backlog.md`, with priorities tagged inline.
Top of queue (after this PR merges):

- **P0:** _empty (B-010 closed by this PR)_
- **P1:** B-017 (tray), B-040 (Google file picker), B-043 (prod
  hardening), B-047 (manual sec audit half)
- **P2:** B-002, B-009, B-011, B-012, B-013, B-018, B-019, B-021,
  B-022, B-032, B-039, B-041, B-044
- **P3:** B-005, B-014, B-020, B-023, B-024, B-025, B-029, B-030,
  B-031, B-036, B-045, B-046, B-048, B-050
- **DEFERRED:** B-035

## Recommended next bundles

1. **Bundle C — repo hygiene** (B-046 `.gitkeep` cleanup + B-043
   production DevTools lockdown). Mechanical, low-risk.
2. **Bundle D — Google provider config** (B-040 file picker +
   validation + connection test, B-012 API-key alternative for Basic
   edition). All in `electron/providers/google/*` + provider settings
   UI.
3. **Bundle E — system tray** (B-017). Unblocks B-013 background
   listening, B-018 launch-at-startup, and B-019 close-to-tray
   semantics.

## Update protocol

Rewrite this file at the end of every iteration that ships a commit.
Include: current branch, recent merges, in-flight work, test count,
green-state verification, and an explicit pointer at any
yet-uncommitted changes (stashes, dirty worktrees).
