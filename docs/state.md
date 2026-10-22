# Project State — OpenTranslate Desktop

_Last updated: 2026-10-22 (v0.1.0 release prep — multi-arch builds + dependency refresh + security alert cleanup integrated on `feature/multi-arch-builds`)_

---

## Active context

- **Current phase:** v0.1.0 release prep — multi-arch builds, dependency
  refresh, security alert cleanup. Integrated and validated locally;
  awaiting review, push and PR.
- **Current branch:** `feature/multi-arch-builds`
- **Parent branch:** `develop`
- **Next steps:** review the branch, push, open the PR into `develop`, let
  `ci.yml` run `checks.yml` + the 4-target `package.yml` (first run of the
  Windows x64 and native Intel mac jobs), then tag `v0.1.0` and publish the
  draft pre-release.
- **What landed on this branch:**
  - **Multi-arch builds:** four targets (mac arm64, mac x64, win x64,
    linux x64) with arch-suffixed artifact names, `scripts/package.mjs
    --arch`, `--publish never`, `scripts/verify-package.mjs` (native
    binary header checks per target), packaged Playwright smoke
    (`pnpm test:e2e:packaged`), reusable `checks.yml` + `package.yml`,
    `release.yml` draft pre-release with `SHA256SUMS.txt`, SHA-pinned
    actions, Dependabot 7-day cooldown. See `docs/packaging.md`.
  - **Dependency refresh:** Electron 44.9.3, electron-builder 26.15.3,
    Nuxt 4.6.1, Nuxt UI 4.11.3, Pinia 4, VueUse 15, Vitest 5, ESLint 10,
    TypeScript 6.0, pnpm 10.34.7. `pnpm-workspace.yaml`
    `minimumReleaseAge: 10080` holds every dependency to ≥ 7 days old;
    only `electron` is exempt (security patch line of the pinned `^44`
    major).
    Only `better-sqlite3` + `uiohook-napi` stay in `dependencies`.
    Electron 44 async `clipboard.readText()` handled in quick-translate.
  - **Native modules:** better-sqlite3 13 + uiohook-napi load N-API
    prebuilds; postinstall `electron-rebuild`, the per-arch rebuild and
    `@electron/rebuild` are gone; better-sqlite3 is in
    `pnpm.ignoredBuiltDependencies`; each package ships only its target
    prebuild.
  - **Security:** `safeHandler` rethrow carries no `cause`; full-tree
    `pnpm audit`, Trivy (dev deps included) and license check;
    `handlebars` override to 4.7.10; ignored advisories and license
    exclusions documented in `docs/security.md`.
  - **CI/release hardening (review + audit follow-ups):** CI runs once per
    PR (push only on `master`/`develop`); composite actions
    `setup-workspace` + `linux-electron-deps` replace copy-pasted setup;
    `timeout-minutes` on every job; no `${{ }}` in `run:` scripts; gitleaks
    `pull-requests: read`, comments off; Semgrep 1.181.0 (≥ 7 days);
    publish refuses to touch a published release and attests build
    provenance; Dependabot scans `.github/actions/*`.
  - **Code review follow-ups:** tray clipboard forwarding goes through the
    quick-translate controller (required logger, separate read/send
    errors); boundaries policies built from a layer table
    (`eslint.config.mjs` 500 lines); verify logic in typed
    `scripts/packaging/verify-checks.ts` incl. executable arch check and
    combined-arch prebuild dirs; `scripts/tsconfig.json`
    (`erasableSyntaxOnly`, `verbatimModuleSyntax`); packaged smoke fails
    in CI without an app and never leaks its temp profile.
- **Deferred (see `docs/backlog.md`):** B-056 boundaries lint has no
  import resolver (5 known violations); B-057 navigation / window-open /
  permission guards + Electron fuses; B-058 Electron 45 after its
  cooldown (async `safeStorage` before Electron 46); B-066 drop the
  handlebars override after the cooldown; B-059 linux arm64 (uiohook-napi prebuild); B-060
  `@nuxt/fonts` 1.0 network-dependent build; B-061 TypeScript 7; B-062
  `@nuxt/ui>@nuxt/fonts` override; B-063 manual Semgrep pin bumps; B-064
  `v*` tag ruleset + `release` environment reviewer; B-065 source maps,
  `smoke.html`, `ELECTRON_SMOKE_TEST` and `OPENTRANSLATE_DEVTOOLS` in
  release builds. Electron stays on 44.x, so the async `safeStorage`
  migration remains backlog-only (B-058).

## Locked v0.1.0 decisions

- Version: `0.1.0` (no alpha suffix); published as a **GitHub
  pre-release**.
- macOS + Windows binaries: **unsigned**; bypass instructions live in
  `docs/install.md`.
- Auto-update: **not wired** (tracked as B-G-19 for v0.1.1).
- Tray template icon: shipped as auto-generated; hand-redesign
  tracked as B-G-18 for v0.1.1.
- DMG background: flat `#F5F5F5` canvas, no decorative logo.
- CHANGELOG.md: user-facing highlights only (no per-B-ID dump).
- Release targets: mac arm64, mac x64, win x64, linux x64 (no arm64 on
  Linux/Windows).
- Supply chain: no dependency younger than 7 days (`minimumReleaseAge`)
  except the Electron patch line of the pinned major; `0.1.0` ships
  Electron 44.9.3, not 45.0.0.

## Green-state verification

_`feature/multi-arch-builds`, 2026-10-22, after `rm -rf node_modules && pnpm install --frozen-lockfile`:_

- `pnpm lint` — clean
- `pnpm typecheck` — clean
- `pnpm test` — **835 tests across 86 files**
- `pnpm test:e2e` — 1/1 (electron-dev, macOS arm64)
- `pnpm audit --audit-level=high` — pass (2 documented ignores, 1 moderate)
- Trivy (lockfile, dev deps included) — only the 2 unfixed, documented highs
- License check (full tree, documented exclusions) — pass
- actionlint — clean; Semgrep 1.181.0 (security-scan configs) — 0 findings;
  zizmor (offline) — no template-injection or permission findings
- Packaged on Electron 44.9.3: mac arm64, mac x64 (Rosetta), linux x64
  (Docker amd64) —
  `verify-package` ✓ and packaged smoke 2/2 each. Windows x64 is
  verified only in CI.

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
- `.github/workflows/security-scan.yml` — full-tree `pnpm audit`, Trivy
  (SHA-pinned, deps incl. dev + IaC + secrets), Semgrep (digest-pinned
  Docker image, security-audit / javascript / typescript / secrets /
  owasp-top-ten), full-tree license-checker (MIT/Apache/BSD/ISC/CC0/BlueOak
  allow-list, documented exclusions), gitleaks full history.
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
