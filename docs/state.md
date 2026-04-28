# Project State — OpenTranslate Desktop

_Last updated: 2026-04-28 (P1 bundle iteration; B-049 in flight)_

---

## Active context

- **Current branch:** `fix/b-049-language-pair` (PR open against `develop`)
- **Parent branch:** `develop`
- **In-flight commit:** `dd48709 — fix(b-049): prevent identical source + target language selection`
- **Last completed iteration:** Bundle B (Error UX) — `feat(b-026/b-042)` merged as `7d7c284`

## Green-state verification

- `pnpm lint` — clean (`@stylistic` + `@typescript-eslint` strict)
- `pnpm typecheck` — clean
- `pnpm test` — **402 tests across 58 suites**
- `pnpm test:e2e` — see CI matrix (Linux xvfb, macOS, Windows)

## Recently merged (chronological, post-Phase 12)

| Hash | PR | Summary |
|---|---|---|
| `7d7c284` | #38 | B-026 + B-042 — Copy/Copied feedback + friendly translation errors with Show details / Copy panel |
| `a8007e9` | #27 | B-007 + B-037 + B-038 — home-screen provider gating, empty-language guard; settings ↔ store sync via `useSettingsPage`; security CI (CodeQL, Dependabot, Trivy, Semgrep, gitleaks, license-check) |
| `80bba6b` | #21 | B-001 + B-003 + B-006 + B-008 — provider bootstrap, empty state, capability-gated UI, first-capable-target fallback |
| `243aa6d` | #22 | B-004 — persisted active-provider selection (structured `ActiveProviderSelection`, store hydrate/migrate) |
| `3cca1ba` | #23 | B-015 — reset-data confirmation modal + `settings:reset` IPC |
| `7a756e5` | #24 | B-016 + B-034 — shortcut recorder + platform-aware default accelerator |
| `c8c5b48` | #26 | B-028 — drop DeepL brand references; rename to "two-pane translator" |

## In flight (this PR)

- **B-049** — Prevent identical source + target language selection.
  - `shared/translation/language-pair.ts`: pure `applySourceChange` /
    `applyTargetChange` swap on collision.
  - `app/pages/index.vue`: change handlers route through helpers.
  - `tests/unit/shared/language-pair.test.ts`: 9 specs incl. swap
    invariant.

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
  store persists through atomic write + quarantine + `migrateActiveProvider`.

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

Open items live in `docs/backlog.md`. Bucket counts (after this PR
merges and B-049 is dropped):

- Provider Selection & State: B-002
- Language Selection: B-005, B-009 (B-049 closed by this PR)
- Documents: B-022
- History: B-010
- Settings: B-011, B-012, B-013, B-014, B-016, B-023, B-039, B-040
- Technical Debt: B-029, B-046, B-048
- Security: B-047
- Error Handling: B-031
- Internationalization: B-030
- Translation UI: B-025
- UI / Layout: B-024, B-041
- Application Lifecycle: B-017, B-018, B-019, B-020, B-021, B-044, B-045
- Packaging & Distribution: B-032, B-043
- Provider Expansion: B-035 (deferred), B-036

Pending develop-only backlog grooming (not yet committed): expanded
B-019 close-behaviour spec, new entries B-039 / B-040 / B-041 /
B-043 / B-044 / B-045 / B-046 / B-047 / B-048 / B-049 — all queued
in a `git stash` on `develop`, awaiting commit approval.

## Recommended next bundles

1. **Bundle C — repo hygiene** (B-046 `.gitkeep` cleanup + B-043
   production DevTools lockdown). Mechanical, low-risk.
2. **Bundle D — Google provider config** (B-040 file picker +
   validation + connection test, B-012 API-key alternative for Basic
   edition). All in `electron/providers/google/*` + provider settings
   UI.

## Update protocol

Rewrite this file at the end of every iteration that ships a commit.
Include: current branch, recent merges, in-flight work, test count,
green-state verification, and an explicit pointer at any
yet-uncommitted changes (stashes, dirty worktrees).
