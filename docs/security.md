# Security Model

OpenTranslate Desktop enforces a strict security boundary between the
Electron main process and the Nuxt renderer.

---

## Architecture

```
Main Process (trusted)
  ├── Provider HTTP calls
  ├── Credential storage (safeStorage)
  ├── File system access
  ├── Clipboard (shortcut-gated)
  └── IPC handlers
        │
        ▼ typed IPC only
Preload Bridge (narrow surface)
  ├── contextBridge.exposeInMainWorld
  ├── Channel whitelist
  └── Argument serialization
        │
        ▼ window.api
Renderer (untrusted)
  ├── UI only
  ├── No network access to providers
  ├── No credential access
  └── No file system access
```

---

## Enforced Security Settings

| Setting | Value | Purpose |
|---|---|---|
| `contextIsolation` | `true` | Prevents renderer from accessing Node.js or Electron internals |
| `nodeIntegration` | `false` | No `require()` or Node globals in renderer |
| `sandbox` | `true` | OS-level process sandboxing |
| `webSecurity` | `true` | Enforces same-origin policy |

These are set in `electron/main/window-factory.ts` and verified by the
E2E smoke test.

---

## Credential Storage

### Secrets vault (`electron/services/secrets/vault.ts`)

- Uses Electron `safeStorage` API (OS keychain: macOS Keychain, Windows DPAPI,
  Linux libsecret)
- Encrypted blobs stored in `userData/secrets.json`
- **No `secrets:get` IPC channel exists** — the renderer cannot read secrets
- Secrets are used in-memory by the main process only
- If `safeStorage` is unavailable (headless Linux), vault runs in ephemeral
  in-memory mode

### What is never exposed to the renderer

- API keys (Google, LibreTranslate)
- Service account JSON contents
- Raw credential bytes in any encoding
- Encryption keys or vault internals

### Logging redaction

The main process logger redacts:
- `api_key`, `apiKey` field values
- Credential file contents
- Secret byte lengths and hashes

---

## IPC Security

### Channel whitelist

The preload bridge (`electron/preload/index.ts`) maintains an `allowedChannels`
Set. Only channels registered in `electron/ipc/channels.ts` are forwarded.
Arbitrary channel names are rejected.

### Argument serialization

`wrapApi()` in `app/composables/useApi.ts` JSON-serializes all arguments
before they cross the context bridge. This prevents Vue reactive proxies
(which contain non-clonable Symbols) from reaching the main process.

### Error normalization

`safeHandler()` in `electron/services/ipc/safe-handler.ts` converts all
thrown errors to plain `Error` objects before IPC transfer. `AppError`
instances (with non-clonable `cause` fields) are safely serialized.

---

## Content Security Policy

Set via `session.defaultSession.webRequest.onHeadersReceived` in
`electron/main/index.ts`.

### Production

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:
```

### Development

Adds `'unsafe-eval'` and Vite dev server URLs for HMR.

> `unsafe-inline` is required for Nuxt hydration scripts. The real
> security boundary is contextIsolation + sandbox, not CSP alone.

---

## Privacy

| Concern | Policy |
|---|---|
| Translation content | Never logged by default |
| Clipboard | Read only after explicit shortcut invocation |
| Telemetry | None. No analytics, no phone-home |
| History | Local only. Never synced. Can be disabled |
| Credentials | OS keychain encrypted. Never leave main process |

---

## Boundary Enforcement

### ESLint (`eslint-plugin-boundaries`)

Layer import rules enforced at lint time:

- `app/` can only import from `shared/`
- `electron/providers/` can import from `shared/` and `electron/services/`
- `electron/services/` can import from `shared/` only
- No circular dependencies across layers

### Test verification

- `tests/integration/secrets-boundary.test.ts` — drives IPC handlers with a
  fixture secret and asserts no handler response contains the secret value
- `tests/e2e/app-launch.e2e.ts` — verifies `require` and `process` are
  undefined in renderer, `window.api` exists

---

## Reporting Vulnerabilities

If you discover a security issue, please report it via
[GitHub Issues](https://github.com/Nks/opentranslate/issues) with the
**security** label.
