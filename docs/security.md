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

The rethrown `Error` deliberately carries **no `cause`**. A cause chain
survives `structuredClone`, so it would ship the raw provider error (response
bodies, stack traces, file paths) to the renderer and into main-process logs.
ESLint's `preserve-caught-error` is suppressed for that one line;
`tests/unit/electron/safe-handler.test.ts` asserts the cause stays absent.

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

Layer import rules configured for lint time (not effective yet: the
plugin has no import resolver, so aliased imports never match a layer —
see `docs/backlog.md`):

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

## Supply Chain

esbuild bundles `dist-electron/main.cjs` and Nuxt prebuilds the renderer, so
almost all shipped code comes from `devDependencies`; only the unbundled
native modules (`better-sqlite3`, `uiohook-napi`) are `dependencies`. Every
gate below therefore runs on the **full** dependency tree, not `--prod`.

### Release age

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days, matching the
Dependabot cooldown): pnpm resolves every direct and transitive dependency to
the newest version published at least 7 days ago. pnpm 10 ignores this
setting in the `package.json` `pnpm` field, so it must stay in
`pnpm-workspace.yaml`.

`minimumReleaseAgeExclude` is empty. When the age gate holds back a security
fix, prefer an override to an already-mature patched version; exempt a
package only when no mature fix exists, and pin the exemption to the exact
version (`name@x.y.z`).

| Override | Reason | Remove when |
|---|---|---|
| `handlebars@<4.7.10` → `4.7.10` | `eslint-plugin-boundaries@7.2.0` and `@boundaries/elements@3.1.1` pin `handlebars@4.7.9` (GHSA-8r5x-fm3f-whwj, GHSA-p8wg-vrv2-v86f, GHSA-xw65-4hp5-5hc7). The fixed plugin release (7.2.1) was one day old; `handlebars@4.7.10` was 17 days old. | `eslint-plugin-boundaries` ≥ 7.2.1 is resolved |

### Vulnerability audit

- `pnpm audit --audit-level=high` (security-scan workflow, all dependencies).
- Trivy filesystem scan with `TRIVY_INCLUDE_DEV_DEPS=true`.

Ignored advisories (`pnpm.auditConfig.ignoreGhsas` in `package.json`) — high
severity, no patched release exists, and the vulnerable code never ships or
runs on untrusted input:

| Advisory | Package | Path | Why unreachable | Revisit when |
|---|---|---|---|---|
| GHSA-vfj7-8cjw-p6xm | `braces@3.0.3` (stack-exhaustion DoS on deeply nested patterns) | `eslint-plugin-anti-trojan-source` › `anti-trojan-source` › `globby` › `fast-glob` › `micromatch`; also `eslint-plugin-boundaries` › `micromatch` and `nitropack` › `globby` | Lint- and build-time only; glob patterns come from repo config, never from user input; absent from `dist-electron/` and `.output/public/` | A patched `braces` release exists, or `micromatch` drops it |
| GHSA-86w9-cpqp-85rv | `node-forge@1.4.0` (RSA PKCS#1 v1.5 signature verification accepts extra DigestAlgorithm elements) | `nuxt` › `@nuxt/nitro-server` › `nitropack` › `listhen` | `listhen` only generates a self-signed certificate for `nuxt dev --https`; nothing verifies signatures; absent from the packaged app | A patched `node-forge` release exists, or `listhen` drops it |

Moderate `GHSA-hp3w-g68c-fv3c` (`sprintf-js` via `electron-builder` ›
`@electron/get` › `global-agent` › `roarr`) is below the gate and build-time
only.

### License compliance

`license-checker-rseidelsohn` runs on the full tree against the allow-list
`MIT;MIT-0;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;CC0-1.0;CC-BY-4.0;0BSD;Unlicense;Python-2.0;BlueOak-1.0.0`.
The allow-list is never widened; packages outside it are excluded by name
only after confirming none of their code reaches `dist-electron/`,
`.output/public/` or `app.asar`:

| Package | License | Pulled in by | Why it never ships | Revisit when |
|---|---|---|---|---|
| `eslint-plugin-sonarjs` | LGPL-3.0-only | direct devDependency | ESLint plugin | Never shipped by design |
| `@sonarsource/analyzer-commons-configurations` | LGPL-3.0-only | `eslint-plugin-sonarjs` | ESLint plugin data | Never shipped by design |
| `lightningcss` | MPL-2.0 | `@tailwindcss/node`, `@nuxt/fonts` | Build-time CSS compiler; only its CSS output ships | A runtime import of it appears |
| `spdx-exceptions` | CC-BY-3.0 | `anti-trojan-source` › `meow` › `normalize-package-data` | Lint-time license-expression data | A runtime import of it appears |
| `truncate-utf8-bytes` | WTFPL | `electron-builder` › `builder-util` › `sanitize-filename` | Packaging-time only | A runtime import of it appears |
| `vaul-vue` | UNKNOWN (no `license` field; upstream repo is MIT) | `@nuxt/ui` | Drawer component; tree-shaken out because the app uses no `UDrawer` | The app starts using `UDrawer`, or the package declares its license |

---

## Reporting Vulnerabilities

If you discover a security issue, please report it via
[GitHub Issues](https://github.com/Nks/opentranslate/issues) with the
**security** label.
