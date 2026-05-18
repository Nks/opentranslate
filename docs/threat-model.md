# Threat Model — OpenTranslate Desktop

_Phase 1 (`feat/p1-bundle`) baseline. STRIDE classification per Microsoft SDL._

Scope: the desktop client only. No server, no telemetry, no sync. Active
adversaries considered: (a) untrusted page or script reaching the renderer via
a future regression, (b) malicious provider response, (c) local user with
filesystem access, (d) network attacker on the path to a provider, (e) other
processes on the same machine, (f) malicious LibreTranslate operator the user
points the app at.

Out of scope: kernel/OS compromise, hardware attacks, physical access with
admin, attacks on Google Cloud itself.

---

## 1. Assets

| ID | Asset | Confidentiality | Integrity | Availability |
|----|-------|-----------------|-----------|--------------|
| A-1 | Google service-account JSON file (path stored in settings, file on disk) | High | High | Medium |
| A-2 | LibreTranslate API key (`safeStorage`-encrypted in `userData/secrets.json`) | High | High | Low |
| A-3 | Provider settings: endpoint URL, edition, `allowSelfSignedTls` flag | Medium | High | Low |
| A-4 | Translation content in flight (renderer ↔ main ↔ provider) | Medium (user-defined) | Low | Low |
| A-5 | Translation history (`userData/history.db`, sqlite/WAL) | Medium | Medium | Low |
| A-6 | `AppSettings` JSON (`userData/settings.json`) | Low | High | Medium |
| A-7 | Renderer process (sandboxed, contextIsolated; reachable only via IPC) | High | High | Medium |
| A-8 | User's filesystem outside `userData` (document pick + write of `*.translated*`) | High | High | Low |
| A-9 | Global shortcut interception state (uiohook-napi key observer) | Medium | Medium | Low |
| A-10 | OAuth2 Bearer access tokens (transient, in-memory in main only) | High | High | Low |

---

## 2. Trust Boundaries

| # | Boundary | Direction | Mechanism | Trust delta |
|---|----------|-----------|-----------|-------------|
| TB-1 | User ↔ Renderer | input | DOM events, drag-drop, clipboard paste | untrusted → semi-trusted UI |
| TB-2 | Renderer ↔ Preload | call | `contextBridge` exposing `window.api` | sandbox barrier — contextIsolation enforces clone-only payloads |
| TB-3 | Preload ↔ Main | RPC | `ipcRenderer.invoke` over allowlisted channels from `electron/ipc/channels.ts` | sandboxed renderer → full-Node main |
| TB-4 | Main ↔ Disk (settings, history.db, secrets.json) | I/O | `node:fs`, `better-sqlite3`, `safeStorage` | main → OS user filesystem |
| TB-5 | Main ↔ Disk (picked credential file, picked document, written translated doc) | I/O | `node:fs` on user-chosen paths | main → arbitrary path in user's filesystem |
| TB-6 | Main ↔ Network | HTTPS | `fetch`/`undici` to `translation.googleapis.com` and configured LibreTranslate endpoint | main → public/private network |
| TB-7 | Main ↔ OS | syscalls | `globalShortcut`, `clipboard`, `uiohook-napi` N-API, `dialog` | main → OS desktop services |
| TB-8 | Provider operator ↔ Main | data | response bodies from Google / LibreTranslate (incl. user-controlled endpoint) | semi-trusted (Google) / untrusted (arbitrary Libre deployment) → main |

Architecture invariant (see `docs/architecture.md` §4): all renderer→provider
traffic must cross TB-3 then TB-6. Renderer has no `fetch` to provider hosts
(enforced by `eslint-plugin-boundaries`).

---

## 3. STRIDE Threats

Stable IDs: `T-S-NN` Spoofing, `T-T-NN` Tampering, `T-R-NN` Repudiation,
`T-I-NN` Information disclosure, `T-D-NN` Denial of service,
`T-E-NN` Elevation of privilege.

### 3.1 Spoofing (S)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-S-01 | Malicious page loaded in renderer via remote-content regression impersonates `window.api` consumer | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` (`window-factory.ts`), production CSP `default-src 'self'`, renderer loads from `file://` (`.output/public/index.html`) | No `will-navigate` / `setWindowOpenHandler` guard → see T-E-04 |
| T-S-02 | DNS / TLS MITM impersonates `translation.googleapis.com` and steals service-account-derived Bearer token | Google client uses default `undici.Agent` (`http-client.ts:38`) → strict TLS; Bearer is short-lived; access token sent only to `translation.googleapis.com` | No certificate pinning. Token still valid for token lifetime if intercepted |
| T-S-03 | Attacker-controlled LibreTranslate endpoint impersonates a trusted instance and harvests API key | Endpoint URL must be validated by `libreTranslateSettingsSchema` (Zod) before adapter call; API key never leaves main; user explicitly configures endpoint | If user opts in to `allowSelfSignedTls`, MITM trivial inside that LAN. No pinning of public-instance fingerprints |
| T-S-04 | Hostile process on same machine spoofs a second-instance handoff to focus our window with attacker URL | `app.requestSingleInstanceLock()` (`index.ts:28`); `second-instance` handler only focuses, does not parse argv | Second-instance argv is not parsed, so no URL handling abuse path today |
| T-S-05 | Phishing IPC: arbitrary script in renderer calls `window.api.secrets.set({providerId:'google', secret:'…'})` while user is unaware | Preload allowlist (`allowedChannels` set in `preload/index.ts:46`); UI flow drives all writes; settings UI is the only legitimate caller | No origin/window-id check on IPC handler. Any code with renderer execution can call `secrets:set` |
| T-S-06 | Spoofed `quick-translate:text` push event from compromised renderer triggers a different window | Push is one-way main→renderer (`mainWindow.webContents.send` in `index.ts:53`); renderer cannot emit `quick-translate:text` to itself across windows | Renderer-side handler `ipcRenderer.on('quick-translate:text', …)` accepts any sender frame (no `event.senderFrame` check) |
| T-S-07 | Forged Google OAuth response (offline cached file at `credentialsJsonPath`) issues attacker-controlled token | `google-auth-library` validates JWT signature against Google JWKS; access tokens fetched live | Path is user-chosen — if attacker replaces the JSON on disk, future calls use that identity (not our threat, but covered by integrity rule) |

### 3.2 Tampering (T)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-T-01 | On-disk tamper of `userData/settings.json` to point Libre endpoint at malicious host | Load-path runs `settingsFileSchema.safeParse` then per-provider Zod (`store.ts:237-244`); invalid file is quarantined (`*.corrupted-<ts>`) and defaults are restored | Schema-valid but malicious endpoint passes (endpoint is just a URL); user has no warning when active endpoint changes outside the app |
| T-T-02 | On-disk tamper of `userData/history.db` to inject misleading entries | `better-sqlite3` opens any sqlite file; schema is `CREATE IF NOT EXISTS`; rows trusted as written | None at app level — history is treated as user data; integrity relies on OS file permissions |
| T-T-03 | Hostile renderer script injects a non-schema-valid `settings:update` payload, e.g. negative timeout, prototype pollution | `mergeProvidersWithRegistry` rejects via Zod (`store.ts:67-107`); merge uses spread on plain objects only; app shell `settingsFileSchema.shape.app.safeParse` enforces shape on save | `mergeSettings` spread of `patch.app` (`store.ts:132`) is not protected against `__proto__`/`constructor` keys reaching Zod parser — Zod strips unknown keys, but a strict prototype-pollution test should be added |
| T-T-04 | Malicious provider response with embedded HTML/script for `format: 'html'` translations is rendered in renderer | Default `format: 'text'`; Vue interpolation `{{ }}` escapes; Nuxt UI textareas treat output as text | HTML format flag exists in shared types — if any future UI path uses `v-html` on translated text, XSS path opens |
| T-T-05 | Document service writes translated file outside intended directory via crafted source path (e.g. symlink, `..` traversal in basename) | Output path computed via `node:path` `dirname`/`extname`/`basename` (`documents/service.ts:37-42`); no shell exec | No symlink resolution check, no allowlist of writable roots; provider-returned bytes saved unchanged into computed path |
| T-T-06 | History `LIKE` query injection from search box | Pattern is parameterized `@pattern` with `LIKE '%query%'` (`history/store.ts:141`); no string concat | `%` and `_` in query are interpreted as wildcards (not security, but correctness — escape would improve UX) |
| T-T-07 | Tamper of `secrets.json` cipher to swap one provider's key into another's slot | `safeStorage` encrypts per-string; swap is detectable only when adapter call fails auth | No HMAC over the file, no per-entry binding to providerId in the ciphertext |
| T-T-08 | IPC handler reorders / mis-routes the active translation result (latest-wins violation) | Orchestrator monotonic sequence (architecture §8.3.2); stale results discarded | Not yet code-reviewed in this scope; assumed correct from contract |

### 3.3 Repudiation (R)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-R-01 | User claims they did not paste / send specific text to a provider | History records source + translation + provider + timestamp when enabled | History is opt-out (`enabled` flag) — no record exists when disabled or when quick-translate is used and history is off |
| T-R-02 | User claims they did not store a credential | `secrets.json` `lastUpdated` ISO timestamp per provider id (`vault.ts:113`) | No audit log, no append-only history; `set` overwrites silently |
| T-R-03 | Provider operator denies serving a specific response | No request/response capture by design (privacy rule); `console.error` logs are best-effort and not durable | Acceptable trade-off — durable request log would violate "no content logging by default" |
| T-R-04 | Translation written to a document file with no record of source bytes | Provider returns file unchanged; we save it; no manifest, no checksum | Stateless by design |
| T-R-05 | Settings reset / quarantine erases a tamper trace | Quarantine renames to `settings.json.corrupted-<ts>` (`store.ts:194-199`) — preserved on disk | Best-effort: rename failure swallowed (`store.ts:197`); no user-visible notice yet |
| T-R-06 | Shortcut chord fires while user is unaware (e.g. `Cmd+C+C` during normal copy) | Chord requires double-press within 500 ms (`quick-translate-controller.ts:40`); first press never suppressed | Inherent — short chord may collide with rapid copy-copy user behavior |

### 3.4 Information Disclosure (I)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-I-01 | Renderer reads secret via IPC | **No `secrets:get` channel exists** (`channels.ts:48-49`; architecture §8.1, forbidden shortcuts §8); preload allowlist excludes it; `getMainOnly` is not exposed across `contextBridge` | Architectural invariant — must be regression-tested forever (`tests/integration/secrets-boundary.test.ts` exists) |
| T-I-02 | Logs leak credentials, plaintext secret, or translation content | `vault.ts` logs nothing today (no `console.*` in file); preload IPC catch logs only error.message (`preload/index.ts:63`); console.error in main does not see secret values | Generic `console.error('[IPC:channel]', message, err)` could surface `err.cause` containing request body if a future provider throws with request context attached — needs redaction policy in `safeHandler` |
| T-I-03 | `safeStorage` unavailable → ephemeral in-memory mode silently holds secrets without OS encryption | `canPersist` short-circuit returns `ephemeral: true` (`vault.ts:74,100-110`); secret never written to disk; cleared on process exit | UI does not surface the ephemeral state today; user may believe their key is persisted. Architecture §8.1.5 mandates a "credentials not persistable" badge (Phase 10) |
| T-I-04 | Service-account JSON contents leaked via error message | `google/auth.ts` wraps errors as `AppError(AuthenticationFailure, "google: …")` — does not include the JSON bytes | If `google-auth-library` throws an error whose message embeds file contents (unlikely), we re-string it via `(err as Error).message` and propagate — no allowlist on message content |
| T-I-05 | Translation content logged or persisted by accident | Architecture rule: no content logging by default; orchestrator does not log payloads | `console.error('[IPC:translation:translate]', …)` in preload prints the error string, which today never includes the body; no contract test |
| T-I-06 | LibreTranslate API key visible in URL/query string in proxy logs | Sent as form-encoded body `URLSearchParams` (`libretranslate/http-client.ts:78-85`), not in URL | An intermediate proxy logging request bodies would still see the key. User's responsibility on self-hosted endpoints |
| T-I-07 | Bearer token reused across providers | Google bearer is scoped to `cloud-translation` (`auth.ts:32`); only attached on requests to `V2_BASE` (`google/http-client.ts:60`) | Token lives in `getAccessToken()` closure; no explicit zeroization after use |
| T-I-08 | DevTools opens in packaged build and exposes internals | `allowDevTools = !app.isPackaged` (`main-window.ts:25`); `before-input-event` blocks `Ctrl+Shift+I`, `F12`, `Alt+Cmd+I` (`devtools-blocker.ts`); `devtools-opened` event force-closes | Blocker is keyboard-only — programmatic open via menu would also fire `devtools-opened` and be closed. New main-window-spawn paths could miss the listener registration |
| T-I-09 | Window screenshot/screen-share captures plaintext translation history while showing a sensitive entry | Out of scope for app | Could add macOS "private window" hint or `setContentProtection(true)` toggle |

### 3.5 Denial of Service (D)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-D-01 | Renderer floods `translation:translate` requests | Renderer debounces (`useTranslation`, architecture §8.4.3, default 350 ms); orchestrator cancels prior in-flight via `AbortController` | No server-side rate limit at IPC layer; a buggy renderer can still spin (CPU on debounce) |
| T-D-02 | Provider returns gigabyte-size response (Libre `translate_file`) | Provider HTTP kernel respects `requestTimeoutMs`; `AbortSignal.timeout` (architecture §8.2.2) | No max-response-size cap configured |
| T-D-03 | Settings file grows unbounded (per-provider slice accumulation) | Schema-bounded shape per provider; unknown provider ids are dropped on save (`mergeProvidersWithRegistry` walks the registry, not the patch) | None at this layer |
| T-D-04 | History fills disk | Retention modes: `last-30-days`, `last-100-entries`, unlimited (`history/store.ts:88-95`); user can clear | "Unlimited" mode is the worst case; no disk-watermark warning |
| T-D-05 | Repeated chord fires lock up the main process reading clipboard | `setTimeout(handleChord, 100ms)` (`quick-translate-controller.ts:39,75`) — one timer per chord, no queue back-pressure | Two rapid chords overlap two `setTimeout`s; harmless today but should be coalesced |
| T-D-06 | Long-running document translation blocks orchestrator | `translateDocument` awaited from IPC handler; no cancel path on doc channels | Document translation is single-shot per call; user must wait or close window |
| T-D-07 | Hostile renderer pumps `history:add` to grow DB | `add` requires `enabled` true; otherwise no-op (`history/store.ts:102-104`); retention prune runs on every insert | When enabled, no rate cap on insert; sqlite write throughput is the only ceiling |
| T-D-08 | `safeStorage` decrypt failure on every read blocks settings UI | `getMainOnly` propagates decrypt error; settings load wraps in try/catch and falls back to defaults | Decrypt-storm in adapters would surface as `AuthenticationFailure` per request — user-visible but does not crash |

### 3.6 Elevation of Privilege (E)

| ID | Threat | Mitigations | Residual |
|----|--------|-------------|----------|
| T-E-01 | Renderer escapes sandbox via Chromium 0-day | Sandbox enabled, contextIsolation enabled, `nodeIntegration: false`; OS sandbox is the last line | Out of app control; Electron upgrade discipline mitigates |
| T-E-02 | Renderer invokes unallowlisted IPC channel | `allowedChannels` Set check in preload (`preload/index.ts:46,52-54`); main `ipcMain.handle` only registers listed channels | Strong — but quick-translate channels are cast `as never` (`preload/index.ts:125,127`), bypassing compile-time allowlist; runtime check still gates them |
| T-E-03 | Preload exposes a property reachable by mutation (prototype pollution from renderer side) | `contextBridge` deep-clones values on cross-isolated-world transfer; primitives + functions only | `wrapApi()` (renderer) JSON-serializes args; if a future preload path stops calling `wrapApi`, reactive proxies leak Symbols and may throw, not pollute |
| T-E-04 | Renderer is navigated to attacker URL via `window.open`, `<a target=_blank>`, or `location.href`, then preload still exposes `window.api` | No `setWindowOpenHandler({action:'deny'})`, no `will-navigate` guard registered today | Real residual — see follow-up B-G-01 |
| T-E-05 | Main process runs with elevated rights → `child_process` from a dependency | App does not spawn child processes; native deps (`better-sqlite3`, `uiohook-napi`) are linked, not exec'd | Out-of-app supply-chain risk is the dominant remaining vector |
| T-E-06 | uiohook-napi key observer captures all keystrokes across OS (privilege uplift compared to scoped shortcut) | macOS requires Accessibility permission gated by `ensureAccessibilityPermission`; user grants explicitly | All keystrokes are observable while running. Mitigated by chord detector consuming events without storing them, but the capability exists. Document trade-off in `docs/security.md` |
| T-E-07 | `dialog.showOpenDialog` returns symlinked path that the user did not intend; document service follows it | `node:path` operations are lexical; no `realpath`/`symlink` resolution | Provider receives `sourcePath` as given; written-to dir is the lexical `dirname` of that path |
| T-E-08 | A future provider adapter spawns a child process or writes outside `userData` | `electron-providers` may import `electron-services` (per architecture §8.2.1); no lint rule prevents `node:child_process` import inside providers today | Add ESLint rule or boundary forbidding `node:child_process` and arbitrary `fs.writeFile` outside services/documents — see B-G-02 |

---

## 4. Residual Gaps & Proposed Backlog

Proposed IDs only — do **not** add to `docs/backlog.md` in this task.

| Proposed ID | Gap | Linked threats | Effort |
|-------------|-----|----------------|--------|
| B-G-01 | Add `setWindowOpenHandler({action:'deny'})` + `will-navigate` guard to every `BrowserWindow` (main + overlay); open external links via `shell.openExternal` only after origin allowlist | T-E-04, T-S-01 | S |
| B-G-02 | ESLint boundary rule: providers cannot import `node:child_process`, `node:fs/promises` write APIs, or arbitrary network outside `electron/services/http/` | T-E-08, T-T-05 | S |
| B-G-03 | Sender-frame check in IPC handlers (`event.senderFrame.url` against allowed origins) and renderer `ipcRenderer.on` listeners | T-S-05, T-S-06 | M |
| B-G-04 | Prototype-pollution unit test for `mergeSettings` with `__proto__`, `constructor`, `prototype` keys in patch | T-T-03 | S |
| B-G-05 | Surface `ephemeral: true` from `secrets:set` response in the Settings UI as a non-dismissable warning badge (architecture §8.1.5 already mandates) | T-I-03 | S |
| B-G-06 | Redaction policy in `safeHandler` / preload error logger — drop `err.cause`, never log `URLSearchParams` bodies, allowlist of safe `err.message` shapes | T-I-02, T-I-05 | M |
| B-G-07 | Document service: enforce `dirname(filePath)` is inside an allowed root (user's home or explicit pick directory); refuse to write across symlinks; resolve `realpath` first | T-T-05, T-E-07 | M |
| B-G-08 | Max-response-size guard in provider HTTP kernel (`provider-http.ts`); reject early on `Content-Length` and on streaming body overflow | T-D-02 | S |
| B-G-09 | Per-entry providerId binding inside encrypted secrets (encrypt `JSON.stringify({providerId, secret})`, verify on decrypt) | T-T-07 | S |
| B-G-10 | Optional `setContentProtection(true)` toggle for the main window (privacy mode: hide from screen-share/screenshot) | T-I-09 | M |
| B-G-11 | Production CSP: drop `'unsafe-inline'` on `style-src` once Nuxt UI hydration is verified compatible; explore nonce-based `script-src` for hydration | T-S-01 | L |
| B-G-12 | Refuse to load settings whose `app.activeProvider.providerId` is unknown to the registry (today: validated by per-provider Zod, but `activeProvider` shape is in `AppSettings` — needs an explicit registry check on load) | T-T-01 | S |

---

## 5. Cross-check vs `AGENTS.md` Security Rules

| `AGENTS.md` §  | Rule | Code anchor | Threats mitigated | Uncovered residual |
|----------------|------|-------------|-------------------|---------------------|
| Security §1 | `contextIsolation: true`, `nodeIntegration: false`, sandbox where possible | `window-factory.ts:23-25` | T-S-01, T-E-01, T-E-03 | T-E-04 (no nav guard) → B-G-01 |
| Security §2 | Renderer never accesses provider credentials. No `secrets:get` IPC exists or will exist | `channels.ts:40-63`, `preload/index.ts:46,83-88` | T-I-01, T-I-04, T-I-07 | Test exists (`tests/integration/secrets-boundary.test.ts`) — must remain green forever |
| Security §3 | Credentials read + used only in main; `safeStorage` round-trip | `vault.ts`, `google/auth.ts:30-32`, `google/http-client.ts:60-62` | T-I-01, T-T-07, T-S-03 | T-I-03 ephemeral mode not surfaced → B-G-05; T-T-07 providerId binding → B-G-09 |
| Security §4 | Logs redact secrets + translation content by default | `vault.ts` (no `console.*` of secrets), `preload/index.ts:63` | T-I-02 | No `safeHandler` redaction policy → B-G-06 |
| Security §5 | Clipboard read only after explicit quick-translate invocation | `quick-translate-controller.ts:75-82` | T-S-06, T-R-06 | None — chord-gated by design |
| Security §6 | No hidden telemetry | grep confirms no telemetry imports | — (positive invariant) | None |
| Security §7 | Validate user input + IPC payloads at boundary with zod; sanitize file paths | `settings/store.ts:67-107,237-256` (zod), `documents/service.ts:33-42` (path) | T-T-01, T-T-03 (partial) | Path sanitization is lexical only → B-G-07; prototype-pollution test → B-G-04 |
| Security §8 | CSP locked in `electron/main/csp.ts`; no RCE in renderer | `csp.ts:16-22` | T-S-01, T-T-04 | Production allows `'unsafe-inline'` on script + style → B-G-11 |
| Forbidden §9 | No direct renderer network calls to providers | `eslint-plugin-boundaries` (architecture §1, invariant 2) | T-S-02, T-S-03, T-I-06 | Enforced at lint time; no runtime guard |
| Forbidden §10 | No persistent logging of translation content by default | History opt-in + retention; no logger writes content | T-R-01, T-I-05 | Acceptable |

---

## 6. Threat Counts

| Class | Count |
|-------|-------|
| Spoofing (S) | 7 |
| Tampering (T) | 8 |
| Repudiation (R) | 6 |
| Information disclosure (I) | 9 |
| Denial of service (D) | 8 |
| Elevation of privilege (E) | 8 |
| **Total** | **46** |

Residual gaps: 12 proposed backlog items (B-G-01 … B-G-12).

---

## 7. Update Protocol

This document is refreshed at the start of every phase that touches a trust
boundary (IPC surface change, new disk persistence, new network destination,
new global OS capability). Any new bounded context (architecture §2) requires
an entry per STRIDE class, even if the answer is "no new threats".

Last updated: Phase 1 (`feat/p1-bundle`).
