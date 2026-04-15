# OpenTranslate Desktop — Architecture

_Living document. Updated in every phase before code lands._

This is the authoritative architecture reference for OpenTranslate Desktop.
It captures bounded contexts, ubiquitous language, layer ownership,
architecture invariants, anti-corruption seams, and forbidden shortcuts.

For product scope and feature requirements, see:

- `docs/opentranslate-desktop-spec.md`
- `docs/opentranslate-desktop-prd.md`
- `AGENTS.md`

For current implementation status, see `docs/state.md`.

---

## 1. High-level Shape

OpenTranslate Desktop is a three-layer Electron application with a strict
security boundary between the renderer and the OS.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Electron main process                       │
│  • app lifecycle, windows, global shortcuts, clipboard            │
│  • provider HTTP calls (Google, LibreTranslate)                   │
│  • secure storage (OS keychain via keytar)                        │
│  • file system (document translation, history DB)                 │
│  • translation orchestration (debounce, cancel, latest-wins)      │
│                                                                   │
│         ▲                                                         │
│   narrow│ typed IPC only (invoke/handle + on/emit)                │
│         ▼                                                         │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │                    Preload bridge                             │ │
│ │  • contextBridge.exposeInMainWorld                            │ │
│ │  • contextIsolation: true, nodeIntegration: false, sandbox    │ │
│ │  • forwards only approved channels to the renderer            │ │
│ └─────────────────────────────────────────────────────────────┘  │
│         ▲                                                         │
│         │ window.api (typed)                                      │
│         ▼                                                         │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │                Nuxt 4 renderer (Nuxt UI)                      │ │
│ │  • Translate / Documents / History / Settings / About pages  │ │
│ │  • Pinia state; no direct network; no direct credentials     │ │
│ └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              ▲                                              ▲
              │                                              │
              └── shared kernel: types, provider contract, ──┘
                  Zod schemas, error mapper, capability gate
```

### Layer ownership

| Layer | Folder | Owns | Does NOT own |
|---|---|---|---|
| Electron main | `electron/main/`, `electron/services/`, `electron/providers/` | app lifecycle, windows, HTTP to providers, filesystem, keychain, IPC handlers, translation orchestration, history storage, document pipeline | UI, view state, DOM |
| Preload | `electron/preload/` | `contextBridge` IPC surface, channel whitelist, typed `window.api` | business logic, HTTP, secrets in memory |
| Renderer | `app/` (Nuxt) | all screens, user interaction, Pinia stores, capability-gated UI states | network calls, credentials, file system |
| Shared kernel | `shared/` | domain types, provider contract, Zod schemas, error categories, capability gate, pure helpers | Electron APIs, Nuxt APIs, node-only APIs |

The `shared/` layer must remain importable from both main and renderer without
pulling in any process-specific dependency.

---

## 2. Bounded Contexts (DDD-lite)

Seven bounded contexts. Each has a clear owning layer and a named purpose.
There are no aggregates, no domain event bus, no CQRS — pure functions,
value objects, Zod schemas, and repositories.

| # | Context | Purpose | Owner |
|---|---|---|---|
| 1 | **translation** | Orchestrate a single text-translation request: debounce input, cancel stale requests, normalize output, write history on success | main services + renderer view state; types in `shared/` |
| 2 | **provider-integration** | Adapter implementations for Google + LibreTranslate: HTTP, credentials use, native-shape → shared-type normalization, error mapping | `electron/providers/` only |
| 3 | **language-catalog** | Fetch, cache, normalize, and invalidate per-provider supported-language lists; re-validate the current source/target selection on provider switch | `electron/services/` + `shared/` types |
| 4 | **history** | Local persistence, search, reopen, clear, disable of `HistoryEntry` rows | `electron/services/` + `shared/` schema |
| 5 | **document-translation** | Capability-gated file-in/file-out pipeline through the active adapter; output filename convention; provider-returned bytes preserved | `electron/services/` + `electron/providers/` |
| 6 | **settings-and-credentials** | Load/save `AppSettings` and `ProviderSettingsMap`; secret storage via OS keychain; provider configuration validation | `electron/services/` + preload IPC surface; schemas in `shared/` |
| 7 | **quick-translate** | Global shortcut registration, chord detection, clipboard read, overlay window lifecycle; consumes the translation context | `electron/main/` + a dedicated renderer window |

`app-shell-and-ipc` is explicitly **not** a bounded context — it is
infrastructure (Electron plumbing, preload bridge).

---

## 3. Ubiquitous Language (Glossary)

| Term | Definition | Lives in |
|---|---|---|
| **Language** | Normalized language record: `code`, `name`, `providerCode`, `supportsSource`, `supportsTarget` | `shared/types/language.ts` |
| **ProviderId** | `'google' \| 'libretranslate'` — the only allowed discriminator | `shared/types/provider-id.ts` |
| **SourceLanguageSelection** | Tagged union: `{mode:'auto'}` or `{mode:'explicit', code}` — models "Auto Detect" as data | `shared/types/translation.ts` |
| **TranslationInput / TranslationOutput** | Normalized request/response shapes flowing between renderer, services, and adapters | `shared/types/translation.ts` |
| **ProviderCapabilities** | Boolean feature flags reported by each adapter: `textTranslation`, `languageDetection`, `supportedLanguagesDiscovery`, `documentTranslation` | `shared/types/capabilities.ts` |
| **ProviderReadiness** | Discriminated union: `{state:'unconfigured'}` / `{state:'configured'}` / `{state:'ready', capabilities}` — models the spec's three-way capability gate | `shared/types/provider-readiness.ts` |
| **CapabilityGate** | Pure predicate `isFeatureAvailable(feature, readiness, appEnabled)` used uniformly by the UI and the main-process guards | `shared/capability-gate.ts` |
| **HistoryEntry** | Locally-persisted record of a successful translation (only true entity in the system) | `shared/types/history.ts` + schema |
| **AppSettings** | Non-sensitive user preferences: theme, debounce, default target, history policy, shortcuts, active provider | `shared/types/settings.ts` + schema |
| **ProviderSettings** | Per-provider configuration (Google: project/credentials/edition/location; Libre: endpoint/API key/TLS) | `shared/types/provider-settings.ts` + schema |
| **Credentials** | Sensitive provider material held exclusively in main via OS keychain; never part of any IPC surface reachable from preload | `electron/services/secrets/` only |
| **TranslationProvider** | Shared adapter contract every provider implements | `shared/providers/contract.ts` |
| **HealthStatus** | Adapter reachability/validity signal | `shared/types/health.ts` |
| **ErrorCategory / AppError** | Closed set of normalized failure kinds the UI is allowed to receive | `shared/errors/*` |
| **QuickTranslateSession** | Ephemeral state per overlay invocation: trigger event, clipboard snapshot, detected language, translated text, target language, overlay window handle | `electron/services/` (not persisted, never in `shared/`) |

---

## 4. Architecture Invariants

These invariants MUST hold across all phases. Violating any of them requires
an ADR amending this document before the violating code is merged.

1. **Three-way capability gate.** A feature is available only when all three
   hold: configuration is valid AND the provider reports support AND the app
   capability flag is enabled. Enforced by `shared/capability-gate.ts`.
2. **No network in renderer.** The renderer contains no `fetch`, no HTTP
   client, no direct provider call. All provider traffic runs in Electron
   main. Enforced by `eslint-plugin-boundaries` layer rules.
3. **No credentials in renderer.** Preload exposes no API that returns raw
   credential material. Credentials live only inside a main-process secret
   vault and are redacted in logs.
4. **`contextIsolation: true` and `nodeIntegration: false`** for every
   `BrowserWindow`. Sandbox on. Runtime-asserted at window creation and
   verified in E2E smoke test.
5. **Capability gating is real.** Document translation is enabled only when
   the active provider actually reports support at runtime; never inferred
   from configuration alone.
6. **One mapper seam per provider.** Each provider adapter owns exactly one
   `mapper.ts` that converts native response shapes into shared types and
   native errors into `AppError`. Nothing provider-shaped escapes the adapter
   module.
7. **Latest-wins translation.** Only the most recent in-flight translation
   request may update UI state. Prior requests are cancelled via
   `AbortController`.
8. **Local-only history.** No cloud sync. No telemetry. No content logging by
   default.

---

## 5. Anti-Corruption Layers

Three ACL seams, all directional (native → shared). Nothing flows in reverse.

1. **Google native → shared** (`electron/providers/google/mapper.ts`)
   Converts Google Cloud Translation v2 and v3 response shapes into
   `Language`, `LanguageDetectionResult`, `TranslationOutput`. Maps Google
   errors (`PERMISSION_DENIED`, `RESOURCE_EXHAUSTED`, `INVALID_ARGUMENT`,
   `UNAVAILABLE`, `UNAUTHENTICATED`) into `ErrorCategory`. Nothing
   Google-shaped leaves this module.

2. **LibreTranslate native → shared** (`electron/providers/libretranslate/mapper.ts`)
   Converts `/languages`, `/detect`, `/translate`, `/translate_file`
   responses into shared shapes. Maps HTTP status + body `error` strings into
   `ErrorCategory`. The self-signed TLS toggle is handled at the HTTP client
   layer, not in the mapper.

3. **Error → domain** (`shared/errors/mapper.ts::toErrorCategory`)
   Existing. Each provider adapter must delegate or extend this function;
   it never invents its own error categories.

---

## 6. Repository Layout

```
/electron
  /main                 app lifecycle, windows, IPC handlers wiring
  /preload              typed contextBridge IPC surface
  /providers
    /google             Google adapter + google/mapper.ts
    /libretranslate     LibreTranslate adapter + libretranslate/mapper.ts
  /services             settings, secrets, history, documents, shortcuts, translation, language-catalog
  /ipc                  channel registry + typed invoke/handle helpers
/app                    Nuxt 4 renderer (pages, components, composables, stores)
/shared                 types, provider contract, Zod schemas, errors, capability-gate
/tests                  unit, integration, e2e
/docs                   spec, PRD, architecture (this file), state, providers, self-hosting, packaging, security
/scripts                dev + build helpers
```

---

## 7. IPC Channel Registry

All main ↔ renderer communication passes through `electron/ipc/channels.ts`.
The registry names every channel, types its request + response, and is the
single source of truth for the preload bridge.

Phase-2 minimum:

- `app:get-version` — returns the app version string; used by the smoke test
- `app:get-platform` — returns `'darwin' | 'win32' | 'linux'`

Later phases extend this registry:

| Phase | Channels added |
|---|---|
| 3 | `settings:get`, `settings:update`, `secrets:set`, `secrets:test` |
| 4 | `provider:list`, `provider:health`, `provider:capabilities`, `provider:languages` |
| 5 | `translation:translate`, `translation:cancel`, `translation:detect` |
| 7 | `history:add`, `history:list`, `history:search`, `history:delete`, `history:clear`, `history:toggle` |
| 8 | `quick-translate:open`, `quick-translate:close`, `quick-translate:translate` (overlay window) |
| 9 | `document:pick`, `document:translate`, `document:save` |

---

## 8. Forbidden Shortcuts

Explicitly rejected — do not introduce without an ADR:

- direct provider calls from Vue/Nuxt components
- provider secrets stored in plain renderer state
- `contextIsolation: false` or `nodeIntegration: true`
- duplication of provider logic inside UI components
- hardcoded language lists in UI code
- hardcoded document-translation support without a capability check
- server code inside this repository
- OCR, speech, browser-extension, or cloud-sync features
- a third provider beyond Google Cloud Translation and LibreTranslate
- writing to `docs/architecture.md` AFTER code that contradicts it — always
  update the doc first

---

## 9. Testing Strategy

| Tier | Runner | Scope |
|---|---|---|
| Unit | Vitest | adapters, normalizers, validators, error mapper, services, capability gate, IPC channel registry |
| Integration | Vitest + mocked HTTP (`msw-node` / `nock`) | provider flows, settings storage, document orchestration, IPC handler layer |
| E2E | Playwright Electron | launch, translate flow, quick-translate overlay, history, settings, document capability gating, security assertions |

TDD discipline per phase: tests red → implementation → green → refactor.

---

## 10. Update Protocol

This document is updated at the beginning of each phase, before any code for
that phase lands. The phase-specific updates are:

- Phase 2 — this initial doc (baseline shape, layers, BCs, glossary,
  invariants, ACL seams, repo layout, IPC registry stub, forbidden shortcuts,
  testing strategy)
- Phase 3 — expand settings-and-credentials section with secret storage
  mechanics; add `settings:*` / `secrets:*` channels to the IPC registry
- Phase 4 — populate provider-integration section per provider; document
  Google + Libre mapper seams, provider-specific error classes; add
  `provider:*` channels
- Phase 5 — document translation orchestration (debounce, cancel, latest-wins)
  and language-catalog service split; add `translation:*` channels
- Phase 6 — renderer-side notes: Pinia store boundaries, two-pane layout
  invariants, a11y rules
- Phase 7 — history retention + search rules; `history:*` channels; SQLite
  schema notes
- Phase 8 — global-shortcut chord detection, overlay window rules;
  `quick-translate:*` channels
- Phase 9 — document capability gating and filename convention; `document:*`
  channels
- Phase 10 — settings UI structure and validation flow
- Phase 11 — packaging notes (signing, entitlements, artifacts)
- Phase 12 — final polish; self-hosting guide cross-references

If the code deviates from the doc, the doc is wrong or the code is wrong.
Decide, update the doc first, then reconcile the code in the same PR.
