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

## 8.2 Provider Integration (Phase 4)

The `provider-integration` bounded context lives entirely under
`electron/providers/<id>/`. Each provider folder is a fully self-contained
module that satisfies the `ProviderDescriptor` contract (§8.1.3).

### 8.2.1 Per-provider file layout

```
electron/providers/<id>/
  descriptor.ts      defineProvider<TSettings>({...}) — declarative
  adapter.ts         implements TranslationProvider for this provider
  http-client.ts     provider-specific endpoint methods + auth + dispatcher
  mapper.ts          native → shared type + error conversion (ACL seam)
```

Only `descriptor.ts` is exported from the barrel. Every other file is an
internal implementation detail of that provider.

**Shared transport kernel.** Transport mechanics (fetch, abort,
timeout, dispatcher, response parsing, error wrapping) live in
`electron/services/http/provider-http.ts`. Each provider's
`http-client.ts` composes that kernel with its own `errorMapper`,
optional `authHeader` contributor, and endpoint methods. The provider
still owns its high-level API surface (`listLanguages`, `detect`,
`translate`, per-provider probes). This avoids ~150 lines of
duplication between adapters and keeps the response-parsing /
network-error contract in a single tested place.

The `electron-services` layer may be imported by `electron-providers`
(enforced by `eslint-plugin-boundaries`). Services still cannot import
from providers.

### 8.2.2 HTTP client pattern

Each provider owns its HTTP client. Shared rules:

- All HTTP traffic runs in the main process. Renderer has no `fetch` access
  to any provider host (enforced by `eslint-plugin-boundaries`).
- Every request passes through an `AbortSignal` piped from the translation
  orchestration layer so stale requests can be cancelled (Phase 5).
- Every request has a configurable timeout, taken from provider settings
  (`requestTimeoutMs`). The adapter wraps the `AbortSignal` with a timeout
  via `AbortSignal.any([externalSignal, AbortSignal.timeout(timeoutMs)])`.
- Google authenticates via `google-auth-library` using a service account
  JSON file read from `credentialsJsonPath`. The raw credential bytes are
  read only inside `http-client.ts` and never held in settings JSON.
- LibreTranslate uses plain `fetch`. Self-signed TLS is handled by a custom
  `undici.Agent` built with `connect: { rejectUnauthorized: false }` only
  when `allowSelfSignedTls` is true; otherwise the system default agent.
- Every non-2xx response is converted to `AppError` by the mapper before
  leaving the adapter.

### 8.2.3 Anti-corruption mappers (ACL seams)

Three mapping seams — still one per provider plus the shared error mapper:

1. **Google native → shared** (`electron/providers/google/mapper.ts`)
   Converts:
   - `translations[].translatedText` → `TranslationOutput.translatedText`
   - `translations[].detectedSourceLanguage` → `TranslationOutput.detectedSourceLanguage`
   - `detections[][].language` + `.confidence` → `LanguageDetectionResult`
   - `languages.list` → `Language[]`
   - gRPC / REST errors (`PERMISSION_DENIED`, `UNAUTHENTICATED`,
     `RESOURCE_EXHAUSTED`, `INVALID_ARGUMENT`, `UNAVAILABLE`) →
     `ErrorCategory` via `mapGoogleError(err)` which throws `AppError`.

2. **LibreTranslate native → shared** (`electron/providers/libretranslate/mapper.ts`)
   Converts:
   - `/languages` JSON `[{code, name, targets}]` → `Language[]` (where
     `targets` drives `supportsSource` / `supportsTarget`)
   - `/detect` response `[{language, confidence}]` → `LanguageDetectionResult`
   - `/translate` response `{translatedText}` → `TranslationOutput`
   - `/translate_file` response `{translatedFileUrl}` (capability-gated)
   - HTTP status + body `error` string → `ErrorCategory` via
     `mapLibreTranslateError(err)` which throws `AppError`.

3. **Error → domain** (`shared/errors/mapper.ts` + `shared/errors/http-mapper.ts`)
   `toErrorCategory` stays the generic fallback. A new
   `mapHttpStatusToCategory(status)` helper lives in
   `shared/errors/http-mapper.ts` and is called by every provider mapper.
   Provider-specific 400 disambiguation (unsupported language vs. invalid
   response) happens inside the provider mapper, not in the shared helper.

### 8.2.4 Language normalization

Both providers return different shapes for "list of supported languages".
A shared helper `shared/providers/normalize-language.ts::normalizeLanguage`
converts a provider-native shape into the canonical `Language` type:

```
normalizeLanguage({
  providerCode,
  name,
  supportsSource,
  supportsTarget,
}) → Language
```

Each provider mapper builds its native list and pipes items through
`normalizeLanguage`. The mapper decides `code` (the BCP-47-like identifier
the app uses) — Google and LibreTranslate both happen to use BCP-47, so
`code === providerCode` in both cases. A third provider with a different
code scheme would apply its own translation inside its mapper.

### 8.2.5 Capability probing

`TranslationProvider.getCapabilities()` and `supportsDocumentTranslation()`
are implemented per provider and MUST reflect runtime reality, not
configuration alone:

- **Google:** text + detect + list-languages always available when credentials
  validate. Document translation (`documentTranslation: true`) only when the
  configured edition is `advanced` AND `location` is set AND the Advanced
  endpoint responds 200 to a dry probe.
- **LibreTranslate:** text + detect + list-languages are available iff
  `/languages` returns 200. Document translation (`documentTranslation:
  true`) only when `/frontend/settings` or a HEAD probe of `/translate_file`
  indicates support — many public and self-hosted deployments disable it.

The Settings UI renders gated features only when
`isFeatureAvailable(feature, readiness, appEnabled)` returns true, where
`readiness.capabilities` was produced by `getCapabilities()` at the most
recent health check.

### 8.2.6 Secrets integration

- Google credentials: service-account JSON file path stored in settings
  under `credentialsJsonPath`. The Google HTTP client reads the file from
  disk inside `http-client.ts` only when a request is about to run, never
  at startup. Bytes never leave the main process.
- LibreTranslate optional API key: stored in the secrets vault under
  `providerId === 'libretranslate'`. The adapter calls
  `vault.getMainOnly('libretranslate')` right before each request; the
  plaintext is attached as `api_key` form field on the outbound request
  and then discarded.

Neither credential material is ever logged. The main-process logger
redacts known credential field names (`api_key`, `apiKey`,
`credentialsJsonPath` contents) before writing.



- Filesystem errors during load → map to `ErrorCategory.InternalAppError`,
  fall back to defaults, surface to the UI as a one-time "settings reset"
  notice.
- `safeStorage` unavailable → log a redacted WARN at startup; Settings UI
  shows a "credentials not persistable on this system" badge (Phase 10).
- Zod validation failure on load → the corrupted file is renamed aside,
  defaults are used, a `ConfigCorrupted` notice is surfaced.

---

## 8.3 Translation Orchestration (Phase 5)

Two bounded contexts are implemented in Phase 5: **translation** and
**language-catalog**. Both live under `electron/services/`.

### 8.3.1 Language catalog (`electron/services/language-catalog/`)

Owns the per-provider supported-language cache and revalidation logic.

- **`refreshLanguages(adapter)`** — calls `adapter.getSupportedLanguages()`,
  stores the result in an in-memory `Map<string, Language[]>` keyed by
  provider id, and returns the fresh list.
- **`getLanguages(providerId)`** — returns the cached list. Returns an empty
  array if never refreshed; never throws.
- **`revalidateSelection(current, catalog)`** — pure function. Given a
  `{ source, target }` selection and a catalog of languages for the active
  provider, returns a corrected selection: if the current source or target
  is not in the catalog, it is reset to `null` (auto-detect for source,
  first-available for target). Called on every provider switch (§10.6 of
  the spec).

### 8.3.2 Translation orchestrator (`electron/services/translation/`)

Owns the single-request lifecycle: debounce, cancel, latest-wins.

**Flow:**

1. Renderer sends `translation:translate` IPC with `{ text, source, target }`.
2. Orchestrator receives the request. If a prior request is in-flight, it is
   cancelled via `AbortController.abort()`.
3. The orchestrator increments a monotonic sequence number. Only the response
   whose sequence number equals the current sequence may update the return
   value; stale responses are discarded silently.
4. The active provider adapter's `translateText()` is called with the
   composed `AbortSignal` (external + timeout per `requestTimeoutMs`).
5. On success the orchestrator returns the `TranslationOutput` to the
   renderer. On cancellation it returns `null`. On error it maps to
   `AppError` and returns the normalized error to the renderer.

**Debounce** is NOT handled by the orchestrator. The renderer owns debounce
timing (configurable `debounceMs` in `AppSettings`, default 350 ms) so the
user sees immediate feedback in the input pane while network calls are
throttled on the caller side. The orchestrator receives already-debounced
requests and executes them immediately.

**Provider switching:**

When the renderer sends `provider:switch`, the orchestrator:

1. Cancels any in-flight translation.
2. Asks the language catalog to refresh the new provider's language list.
3. Revalidates the current language selection against the new catalog.
4. Returns the revalidated selection + capabilities of the new provider.

### 8.3.3 Phase 5 IPC channels

- `translation:translate` — request: `TranslationInput`, response:
  `TranslationOutput | null` (null = cancelled)
- `translation:cancel` — request: `void`, response: `void`; aborts the
  current in-flight request if any
- `translation:detect` — request: `{ text: string }`, response:
  `LanguageDetectionResult`
- `provider:switch` — request: `{ providerId: string }`, response:
  `{ languages: Language[], capabilities: ProviderCapabilities,
  selection: { source: SourceLanguageSelection, target: string | null } }`
- `language:list` — request: `{ providerId: string }`, response:
  `Language[]` (cached; triggers refresh if empty)

---

## 8.4 Main Translation Window (Phase 6)

The renderer is a Nuxt 4 SPA (SSR off) running inside Electron. It
communicates with the main process exclusively via `window.api` (typed
preload bridge). It has no `fetch`, no HTTP client, no direct provider
access (enforced by `eslint-plugin-boundaries`).

### 8.4.1 Component hierarchy

```
app/
  pages/
    index.vue            Translate page (default route)
  components/
    TranslationInput.vue   source textarea, char counter, clear button
    TranslationOutput.vue  output textarea, copy button, provider badge
    LanguageSelector.vue   dropdown sourced from language catalog
    ProviderSelector.vue   dropdown sourced from provider registry
    StatusBar.vue          loading indicator, error summary, retry
  composables/
    useTranslation.ts      debounced translate trigger, wires store → API
  stores/
    translation.ts         source text, output, source/target selection, loading, error
    providers.ts           active provider, provider list, capabilities
    settings.ts            mirrors AppSettings for UI (read via settings:get)
```

### 8.4.2 Pinia store boundaries

| Store | Owns | Reads from IPC | Writes to IPC |
|---|---|---|---|
| `translation` | input text, translated output, loading flag, last error | `translation:translate` response | `translation:translate`, `translation:cancel` |
| `providers` | active provider id, descriptor list, capabilities, language list, selection | `providers:list`, `provider:switch`, `language:list` | `provider:switch` |
| `settings` | app settings mirror (theme, debounce, history toggle, shortcuts) | `settings:get` | `settings:update` |

Stores do NOT call `window.api` directly in their actions. Instead, a
composable (`useTranslation`) coordinates store writes with IPC calls
so the call site is a single place and easy to mock in tests.

### 8.4.3 Debounce

Debounce lives in the renderer composable `useTranslation`. Default is
`350ms` from `AppSettings.debounceMs`. When the user types, the
composable debounces the IPC call; the orchestrator in main receives
already-debounced requests and executes immediately. This keeps the
input pane responsive while throttling network calls.

### 8.4.4 Two-pane layout invariants

Per spec §13:

- Two-column layout at desktop width
- Source and target language controls above text panes
- Minimal interface chrome
- Strong focus on input and output text areas
- Fast copy interaction (one-click copy to clipboard)
- Light and dark mode via Nuxt UI color mode (system default)

### 8.4.5 Accessibility (a11y)

Per spec §18:

- Full keyboard navigation (`Tab` / `Shift+Tab` through all controls)
- `aria-label` on all interactive elements
- Visible focus ring via Nuxt UI focus utilities
- Screen-reader labels on language selectors, provider selector, copy/clear buttons
- User-scalable font size (rem-based, no fixed px on body text)

### 8.4.6 Tray + close behavior (B-017)

The main window cooperates with a platform-specific system-tray icon and
a settings-driven close policy.

**Tray service** (`electron/main/tray.ts`):

- Three menu items: *Open OpenTranslate*, *Quick Translate*, *Quit*. Click
  callbacks are injected (`onOpen`, `onQuickTranslate`, `onQuit`) so the
  service knows nothing about app wiring.
- Platform-conditional icon resolution under `build/icons/tray/`:
  - macOS — `trayTemplate@2x.png`, marked as a template image so the OS
    re-tints it for light/dark menu-bar appearance.
  - Windows — `tray.ico` (multi-resolution).
  - Linux — `tray.png` (full color, 22×22).
- `setVisible(true)` creates the `Tray`; `setVisible(false)` destroys it.
  Toggling the `showTray` setting flips the icon at runtime without
  restarting the app. `destroy()` is called on `before-quit`.
- **Linux indicator caveat:** tray support depends on a working
  StatusNotifier host (KDE Plasma, recent GNOME with extension, XFCE,
  Cinnamon, …). Vanilla GNOME ships without legacy AppIndicator support;
  the icon simply will not appear there. The app continues to function
  via the main window — close behavior gracefully falls back when the
  tray is not present (see below).

**Close behavior** (`electron/main/main-window-close.ts`):

Two new settings drive the close intercept:

- `AppSettings.showTray: boolean` (default `true`) — whether to register
  the tray icon at startup.
- `AppSettings.closeBehavior: 'ask' | 'hide' | 'quit'` (default `'ask'`).

When the user closes the main window, `handleMainWindowClose()` decides:

1. `isQuitting === true` (user picked *Quit* from the tray or modal)
   → allow the default close.
2. No tray active (`showTray === false` or tray creation failed)
   → allow the default close. There is no point preventing close when
   there is no surface to hide to.
3. `closeBehavior === 'quit'` → allow the default close.
4. `closeBehavior === 'hide'` → `event.preventDefault()` + `win.hide()`.
5. `closeBehavior === 'ask'` → `event.preventDefault()` + send IPC
   `window:close-request` to the renderer. The renderer shows the
   `ConfirmCloseDialog` modal (hide / quit + *Remember this choice*
   checkbox). On the renderer's `window:close-response`, main either
   hides the window or sets `isQuitting = true` and calls `app.quit()`.
   When *Remember* is checked, the renderer also persists the choice
   via `settings:update` before responding.

The two IPC entries live alongside the existing invoke/handle channels in
`electron/ipc/channels.ts`, under the separate `eventChannels` registry
(fire-and-forget `send`/`on` semantics):

- `window:close-request` — main → renderer (no payload).
- `window:close-response` — renderer → main,
  payload `{ choice: 'hide' | 'quit', remember: boolean }`.

This keeps the renderer pure UI: it does not know about `app.quit()` or
window visibility — it only translates the user's choice into a single
IPC response.

---

## 8.6 Quick Translate Overlay (Phase 8)

The `quick-translate` bounded context owns the global shortcut, clipboard
read, overlay window lifecycle, and compact translation display.

### 8.6.1 Shortcut chord detection

The spec requires `Cmd+C+C` (macOS) / `Ctrl+C+C` (Win/Linux) — a rapid
double-press of `C` while the modifier is held. Electron's `globalShortcut`
API registers single key combos, not chords. The implementation uses a
**chord detector** that:

1. Registers `CommandOrControl+C` as a global shortcut.
2. On first trigger, starts a 500ms window.
3. If triggered again within the window, fires the `quick-translate`
   action. Otherwise the trigger expires silently and the next press
   restarts the sequence.
4. The first press MUST NOT suppress the OS copy behavior — the system
   clipboard copy completes normally. The detector acts on the *second*
   press only.

Configurable via `AppSettings.shortcuts.quickTranslate` (string like
`CommandOrControl+C+C`). Can be disabled via
`AppSettings.shortcuts.quickTranslateEnabled`.

### 8.6.2 Clipboard read policy

The clipboard is read **only** after the chord fires — never on a single
copy, never on app startup, never on a timer. The read happens in the
main process via `clipboard.readText()`. The text is passed directly to
the orchestrator; it is not stored or logged.

### 8.6.3 Overlay window

A dedicated frameless `BrowserWindow`:

- `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`
- Small fixed size (e.g. 480×320)
- Positioned near screen center (or near cursor on multi-monitor)
- `show: false` on creation; shown after translation completes
- Closes on `Esc` keypress (captured by the overlay page)
- Shares the same preload bridge as the main window

The overlay loads `app/pages/overlay.vue` via the Nuxt router (dev:
localhost URL with `/overlay` path; prod: static build).

### 8.6.4 Phase 8 IPC channels

- `quick-translate:result` — main → renderer push: sends the translation
  result + detected language + target language to the overlay window
- `quick-translate:open-full` — renderer → main: user clicked "Open in
  full app"; main copies text to main window store and focuses it
- `quick-translate:close` — renderer → main: user pressed Esc or clicked
  close; main hides the overlay

### 8.6.5 Overlay page UI

Compact card showing:

- Detected source language label
- Target language label (last-used, persisted)
- Translated text (read-only)
- Copy button (via `useClipboard`)
- "Open in full app" button
- Retry action (re-translates the clipboard text)
- Esc to close (keyboard listener)

---

## 8.7 Document Translation (Phase 9)

The `document-translation` bounded context owns the capability-gated
file-in/file-out pipeline. All file I/O runs in the main process.

### 8.7.1 Capability gating

Document translation is enabled **only** when
`isFeatureAvailable('documentTranslation', readiness, true)` returns `true`.
The Documents page always renders but translation actions are disabled with
a clear message when the active provider does not support documents.

- **Google:** requires `edition === 'advanced'` + `location` set. V3
  document endpoint deferred — for Phase 9 the gate reports correctly but
  the actual HTTP call is a stub that throws "not yet implemented".
- **LibreTranslate:** `/frontend/settings` probe at runtime.

### 8.7.2 File handling

1. User picks a file via native dialog (`dialog.showOpenDialog`) or
   drag-and-drop (renderer sends the path via IPC).
2. Main process validates file extension against provider-supported formats.
3. Main process calls `adapter.translateDocument({ sourcePath, ... })`.
4. Translated file saved as `<name>.<target-lang>.translated<ext>`
   (e.g., `report.es.translated.pdf`).
5. Provider-returned bytes are saved without modification.

### 8.7.3 Phase 9 IPC channels

- `document:pick` — request: `void`, response: `{ filePath: string } | null`
  (native open dialog in main)
- `document:translate` — request: `{ filePath, sourceLanguage, targetLanguage }`,
  response: `{ outputPath: string } | null`
- `document:status` — request: `void`, response:
  `{ supported: boolean, formats?: string[], message?: string }`

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
- Phase 12 — docs hardening: provider guides, self-hosting, packaging,
  security model, README rewrite

If the code deviates from the doc, the doc is wrong or the code is wrong.
Decide, update the doc first, then reconcile the code in the same PR.

---

## 11. Packaging (Phase 11)

### 11.1 Build pipeline

The full packaging pipeline runs three stages sequentially:

1. **`pnpm build:electron`** — esbuild bundles `electron/main/index.ts` →
   `dist-electron/main.cjs` and `electron/preload/index.ts` →
   `dist-electron/preload.cjs`. CJS format required for Electron.
2. **`pnpm build:renderer`** — `nuxt build` generates static SPA output in
   `.output/public/` (SSR is off).
3. **`electron-builder`** — reads `electron-builder.yml`, packs `dist-electron/`
   + `.output/public/` + production `node_modules` into an asar archive,
   re-runs `npmRebuild: true` to recompile `better-sqlite3` against the
   target Electron ABI, and produces platform-specific installers.

### 11.2 Platform targets

| Platform | Target | Arch | Artifact |
|---|---|---|---|
| macOS | DMG | x64, arm64 | `OpenTranslate Desktop-<ver>-<arch>.dmg` |
| Windows | NSIS installer | x64 | `OpenTranslate Desktop Setup <ver>.exe` |
| Windows | ZIP (portable) | x64 | `OpenTranslate Desktop-<ver>-win.zip` |
| Linux | AppImage | x64 | `OpenTranslate Desktop-<ver>.AppImage` |
| Linux | deb | x64 | `opentranslate-desktop_<ver>_amd64.deb` |

### 11.3 Native modules

Two native modules ship at runtime:

- **`uiohook-napi`** (global key observer behind quick-translate). N-API
  prebuilt binaries shipped per platform/arch via `node-gyp-build` — no
  source rebuild required.
- **`better-sqlite3`** (translation history). Compiles against Electron's
  Node ABI via the `postinstall` script (`electron-rebuild -f -w
  better-sqlite3`); `electron-builder` re-runs the rebuild during
  packaging via `npmRebuild: true` so distributed installers ship the
  correct ABI. The unit test suite never loads the native module — the
  history handler test injects a fake `HistoryStore` at the TypeScript
  interface boundary.

The `.node` binaries are excluded from asar via
`asarUnpack: ['**/*.{node,dll}']` so dynamic loaders can find them
inside packaged builds.

### 11.4 Code signing

Code signing is **documented only** — no signing certificates or secrets are
stored in the repository. The `electron-builder.yml` references macOS
entitlements at `build/entitlements.mac.plist` (JIT, unsigned memory, network
client). Actual signing requires:

- **macOS:** Apple Developer ID certificate + `CSC_LINK` / `CSC_KEY_PASSWORD`
  env vars. Notarization via `@electron/notarize` (not included until a cert
  is available).
- **Windows:** Authenticode certificate. Set via `CSC_LINK` / `CSC_KEY_PASSWORD`
  or `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`.
- **Linux:** No code signing required for AppImage/deb.

### 11.5 Build resources

```
build/
  entitlements.mac.plist    macOS hardened runtime entitlements
  icon.png                  1024x1024 app icon (electron-builder generates all sizes)
```

electron-builder reads `build/` as `directories.buildResources`. It auto-generates
`.icns` (macOS) and `.ico` (Windows) from `icon.png`.

### 11.6 CI release workflow

`.github/workflows/release.yml` runs on `v*` tags pushed to `main`:

1. Checkout + setup pnpm/Node
2. Install dependencies
3. Full build (electron + renderer)
4. Package per platform (matrix: macOS, Windows, Linux)
5. Upload artifacts to GitHub Release

The existing `ci.yml` handles lint/typecheck/test on every push/PR. The release
workflow runs packaging only.

### 11.7 Scripts

- `pnpm package` — full local packaging: build + electron-builder for current OS
- `pnpm package:dir` — unpacked directory output for inspection (no installer)
- `scripts/package.mjs` — orchestrates the build + electron-builder invocation
