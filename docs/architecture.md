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

Phase-2 baseline:

- `app:get-version` — returns the app version string; used by the smoke test
- `app:get-platform` — returns `'darwin' | 'win32' | 'linux'`

Phase-3 additions (settings + secrets):

- `settings:get` — request: `void`, response: `{ app: AppSettings, providers: ProviderSettingsMap }`
- `settings:update` — request: partial settings patch validated against the Zod schemas, response: the freshly-persisted full settings object
- `secrets:set` — request: `{ providerId: ProviderId, secret: string }`, response: `{ stored: boolean }`; the secret bytes flow IN only, never OUT
- `secrets:test` — request: `{ providerId: ProviderId }`, response: `{ present: boolean, lastUpdated: string | null }`; presence check only, never returns the value

There is **no `secrets:get` channel**. The renderer has no legitimate reason
to read a stored secret back, so the channel does not exist. Any future
requirement must be satisfied by a main-process operation that *uses* the
secret, not by exposing the secret.

Later phases extend this registry:

| Phase | Channels added |
|---|---|
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
- a `secrets:get` IPC channel, or any preload method that returns raw
  credential material, or any log line containing a credential value

---

## 8.1 Settings & Credentials (Phase 3)

The `settings-and-credentials` bounded context is owned exclusively by
`electron/services/settings/` and `electron/services/secrets/`. The renderer
has no file-system or keychain access.

### 8.1.1 Settings store (`electron/services/settings/store.ts`)

- **Location:** JSON document at `app.getPath('userData') + '/settings.json'`.
  `userData` resolves per-OS:
  - macOS: `~/Library/Application Support/OpenTranslate Desktop/`
  - Windows: `%APPDATA%/OpenTranslate Desktop/`
  - Linux: `~/.config/OpenTranslate Desktop/`
- **Shape:** `{ schemaVersion: number, app: AppSettings, providers: ProviderSettingsMap }`.
- **Validation:** `settingsFileSchema` (Zod) runs on every load. Invalid or
  corrupted files are renamed aside as `settings.json.corrupted-<ts>` and the
  store falls back to the defaults from `shared/schemas/*`.
- **Atomic write:** `tmp → fsync → rename`. Writing directly to
  `settings.json` is forbidden because a crash mid-write would truncate the
  only copy.
- **Migration:** on load, a pure `migrate(previous, targetVersion)` function
  walks migration steps. Phase 3 ships `schemaVersion = 1` and a no-op
  migration ladder ready for future upgrades.
- **No secrets:** `settings.json` must never contain a field whose name or
  contents is a provider API key, credentials JSON path contents, or any
  token. `ProviderSettings.credentialsJsonPath` is a *path*; the file it
  points to is read ad-hoc by the Google adapter in a Phase 4 step, not
  cached into settings.

### 8.1.2 Secrets vault (`electron/services/secrets/vault.ts`)

- **Primary backend:** Electron `safeStorage` API.
  `safeStorage.isEncryptionAvailable()` → `encryptString` / `decryptString`.
  Encrypted blobs are persisted to `userData/secrets.json` as
  `{ [providerId]: { cipher: <base64>, lastUpdated: <iso-8601> } }`.
  OS-level encryption (macOS Keychain, Linux secret service / libsecret,
  Windows DPAPI) means the on-disk blob is unusable if the OS keychain seal
  cannot be unlocked on this machine under this user.
- **Fallback:** if `safeStorage.isEncryptionAvailable()` is `false` (typical
  on headless Linux without a keyring daemon), the vault refuses to persist.
  It runs in ephemeral in-memory mode for the current session, emits a
  **redacted** warning via the main-process logger, and `secrets:test`
  returns `{ present: false, … }` once the process exits.
- **Logging:** the vault logs only the `providerId`, a boolean
  `bytes-present`, and the `lastUpdated` ISO string. It never logs the
  cipher, the plaintext, the byte length of the secret, or any derivative
  hash. This is the redaction invariant.
- **Never-in-renderer invariant (test-enforced):** an integration test
  (`tests/integration/secrets-boundary.test.ts`) drives the registered IPC
  handlers against a vault loaded with a sensitive fixture value and
  asserts that no handler response contains the fixture byte sequence, in
  any encoding, in any shape.

### 8.1.3 Plug-and-play provider contract

Providers are fully self-describing and register themselves via a contract:

- **`shared/providers/descriptor.ts`** defines `ProviderDescriptor` — a
  type-erased record with `id`, `displayName`, `description`,
  `settingsSchema` (Zod), `defaultSettings`, `settingsFields` (UI field
  metadata), `secretFields` (credential field metadata), and `createAdapter`.
- Providers are declared with the typed DSL `defineProvider<TSettings>({...})`
  which validates raw settings via the provider's Zod schema at adapter
  instantiation time, then hands the strongly-typed object to the adapter
  factory. The resulting descriptor is type-erased so the registry can hold
  heterogeneous provider settings shapes.
- **`electron/providers/registry.ts`** is the process-local runtime registry:
  `registerProvider`, `getProvider`, `listProviders`, `hasProvider`.
- **`electron/providers/index.ts`** is the barrel that imports every shipped
  provider descriptor and calls `bootstrapProviderRegistry()` at startup.

**To add a new provider, the developer only touches two places:**

1. Create `electron/providers/<id>/descriptor.ts` exporting a
   `defineProvider<TSettings>({...})` descriptor with its own Zod schema,
   defaults, field metadata, and adapter factory.
2. Add the descriptor to `shippedProviders` in `electron/providers/index.ts`.

Translation orchestration, settings storage, IPC handlers, preload bridge
surface, and the Settings UI all consume providers exclusively through the
registry. None of them contain a hardcoded list of provider ids.

- The settings store reads the registered providers and validates each
  provider's slice against that provider's own schema on load and save.
- The Settings UI (Phase 10) will auto-render each provider's form from its
  `settingsFields` and `secretFields` metadata via the new `providers:list`
  IPC channel, which returns `ProviderDescriptorDto` (the serializable
  subset of the descriptor — no schemas, no factories, no defaults).
- Secret storage is keyed by provider id strings. The secrets vault does not
  know any provider by name.

### 8.1.4 Responsibility split

| Concern | Owner | Notes |
|---|---|---|
| `AppSettings` + `ProviderSettings` persistence | `settings/store.ts` | Zod-validated JSON, atomic write, migration |
| Secret material persistence | `secrets/vault.ts` | `safeStorage`-encrypted JSON; fallback = ephemeral |
| IPC handlers | `electron/main/index.ts` | registers 4 handlers from the channel registry |
| Preload surface | `electron/preload/index.ts` | exposes typed `settings.*` + `secrets.set`/`secrets.test` (no `secrets.get`) |
| Renderer store | `app/stores/settings.ts` (Phase 10) | mirrors sanitized settings for UI only |

### 8.1.5 Error handling

- Filesystem errors during load → map to `ErrorCategory.InternalAppError`,
  fall back to defaults, surface to the UI as a one-time "settings reset"
  notice.
- `safeStorage` unavailable → log a redacted WARN at startup; Settings UI
  shows a "credentials not persistable on this system" badge (Phase 10).
- Zod validation failure on load → the corrupted file is renamed aside,
  defaults are used, a `ConfigCorrupted` notice is surfaced.

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
