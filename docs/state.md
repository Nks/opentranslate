# Project State — OpenTranslate Desktop

_Last updated: 2026-04-15 (Phase 6 complete, awaiting merge)_

---

## Active Context

- **Current branch:** `feature/main-window` (Phase 6 done, awaiting PR)
- **Parent branch:** `develop` (Phase 0–5 + test hardening merged)
- **Last completed iteration:** Phase 6 — main translation window: deferred
  handler wiring, Pinia stores, two-pane DeepL-style layout, debounce
  composable, provider/language selectors, status bar

## Green-state verification

- `pnpm lint` — 0 errors, 3 non-blocking warnings
- `pnpm typecheck` — clean
- `pnpm test` — **165 tests passing across 23 suites**
- `pnpm test:e2e` — 1 passing

## Phase progress

| # | Phase | Status | Notes |
|---|---|---|---|
| 0–4 | Bootstrap → Providers | **done** | |
| T | Test Hardening | **done** | 90%+ coverage |
| 5 | Translation Orchestration | **done** | |
| 6 | Main Translation Window | **done** | two-pane layout, Pinia stores, IPC handler wiring, composables |
| 7 | History | next | |
| 8 | Quick Translate Overlay | pending | |
| 9 | Documents Screen + Google v3 | pending | |
| 10 | Settings UI | pending | |
| 11 | Packaging | pending | |
| 12 | Docs Hardening | pending | |

## Phase 6 delivered

**Backend wiring (deferred from Phase 5):**
- `electron/services/translation/handlers.ts` — factory connecting
  orchestrator + catalog + registry + vault + settings store; handles
  `provider:switch` (create adapter → set on orchestrator → refresh catalog
  → revalidate selection → return capabilities), `translation:translate`,
  `translation:cancel`, `translation:detect`, `language:list`
- `electron/main/index.ts` — registers all Phase 5 IPC handlers, tracks
  current language selection, passes `getProvider` from registry to handler
  factory
- `electron/preload/index.ts` — complete `window.api` surface:
  `providers.list/switch`, `settings.get/update`, `secrets.set/test`,
  `translation.translate/cancel/detect`, `languages.list`

**Renderer (Nuxt 4 SPA):**
- `app/composables/useApi.ts` — typed access to `window.api`
- `app/composables/useTranslation.ts` — debounced translate trigger
  (configurable `debounceMs`), cancel, clear, provider switch orchestration
- `app/stores/translation.ts` — source text, output, detected lang, loading,
  error
- `app/stores/providers.ts` — active provider, descriptors, languages,
  capabilities, source/target selection + getters for filtered source/target
  lists
- `app/stores/settings.ts` — mirrors `AppSettings` for UI
- `app/components/TranslationInput.vue` — textarea, char counter, clear
- `app/components/TranslationOutput.vue` — readonly textarea, copy, provider
  badge, loading overlay
- `app/components/LanguageSelector.vue` — dropdown from catalog, auto-detect
  option
- `app/components/ProviderSelector.vue` — dropdown from provider registry
- `app/components/StatusBar.vue` — loading spinner, error, retry
- `app/pages/index.vue` — two-pane grid layout wiring all components +
  composables

**Config:**
- `nuxt.config.ts` — `@pinia/nuxt` module added, `@shared`/`@electron`/
  `@app` Vite resolve aliases
- `tsconfig.base.json` — `"lib"` extended with `"DOM"` + `"DOM.Iterable"`
  for renderer TS files
- ESLint globals: `window`, `document`, `navigator` added

**Architecture doc:** `docs/architecture.md` §8.4 — renderer component
hierarchy, Pinia store boundaries, debounce ownership, two-pane layout
invariants, a11y requirements

**Note:** visual testing of the UI requires `pnpm dev` with configured
providers. The renderer compiles and type-checks; the wiring is proven
by backend unit tests + E2E smoke test. Full translate-flow E2E (type →
auto-translate → output) lands in a follow-up iteration when provider
credentials are available in a test fixture.

## Update protocol

Rewrite this file at the end of every iteration.
