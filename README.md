# OpenTranslate Desktop

MIT-licensed desktop translator with a two-pane translation workflow.

Built with **Electron** + **Nuxt 4** + **Nuxt UI** + **TypeScript**.

---

## Features

- Two-pane translation UI with instant results
- Auto-detect source language
- Provider switching (Google Cloud Translation, LibreTranslate)
- Quick translate popup via global shortcut (`Cmd+C+C` / `Ctrl+C+C`)
- Local translation history with search
- Capability-gated document translation
- Light / dark mode (follows system)
- Cross-platform: macOS, Windows, Linux

---

## Quick Start

### Prerequisites

- [Node.js 24](https://nodejs.org/) (see `.nvmrc`)
- [pnpm 10](https://pnpm.io/)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Starts Nuxt dev server + Electron with hot reload. The `postinstall`
script rebuilds `better-sqlite3` against Electron's Node ABI, so a
fresh `pnpm install` followed by `pnpm dev` boots the app cleanly —
no manual rebuild needed. Unit tests use an in-memory mock at the
`HistoryStore` interface boundary, so vitest never loads the native
SQLite binary.

### Build

```bash
pnpm build
```

### Package

```bash
# Full installer for current OS
pnpm package

# Unpacked directory (for inspection)
pnpm package:dir
```

### Test

```bash
# Unit + integration
pnpm test

# E2E (Playwright + Electron)
pnpm test:e2e

# Lint
pnpm lint

# Type check
pnpm typecheck
```

---

## Providers

### Google Cloud Translation

Requires a Google Cloud project with the Translation API enabled and a
service account JSON key.

Supports Basic (v2) and Advanced (v3) editions. Document translation
requires Advanced edition with a location configured.

See [docs/providers/google.md](docs/providers/google.md).

### LibreTranslate

Open-source, self-hostable translation API. Supports text translation,
language detection, and optionally document translation.

```bash
# Start a local instance via Docker
docker compose up -d
```

Configure endpoint in Settings > Providers > LibreTranslate.

See [docs/providers/libretranslate.md](docs/providers/libretranslate.md)
and [docs/self-hosting/libretranslate.md](docs/self-hosting/libretranslate.md).

---

## Architecture

Three-layer Electron application with strict security boundaries:

| Layer | Folder | Responsibility |
|---|---|---|
| **Main process** | `electron/` | Provider HTTP, credentials, file system, IPC handlers |
| **Preload** | `electron/preload/` | Narrow typed IPC bridge (`contextIsolation: true`) |
| **Renderer** | `app/` | UI only (Nuxt 4 + Nuxt UI + Pinia) |
| **Shared** | `shared/` | Types, provider contract, Zod schemas, error categories |

See [docs/architecture.md](docs/architecture.md) and
[docs/security.md](docs/security.md).

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | Living architecture reference |
| [Google provider](docs/providers/google.md) | Google Cloud Translation setup |
| [LibreTranslate provider](docs/providers/libretranslate.md) | LibreTranslate setup |
| [Self-hosting LibreTranslate](docs/self-hosting/libretranslate.md) | Docker + local deployment |
| [Packaging](docs/packaging.md) | Building installers for all platforms |
| [Apple signing](docs/apple-signing.md) | macOS code signing and notarization |
| [Security](docs/security.md) | Security model and privacy |
| [Backlog](docs/backlog.md) | Post-phase deferred items |
| [Project state](docs/state.md) | Current implementation status |
| [Specification](docs/opentranslate-desktop-spec.md) | Product specification |
| [PRD](docs/opentranslate-desktop-prd.md) | Product requirements |

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Development mode (Nuxt + Electron hot reload) |
| `pnpm build` | Typecheck + build electron + build renderer |
| `pnpm package` | Full packaging for current OS |
| `pnpm package:dir` | Unpacked directory output |
| `pnpm test` | Unit + integration tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright + Electron) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm rebuild` | Rebuild native modules for Electron |

---

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Credentials stored via OS keychain (Electron `safeStorage`)
- No provider network calls from renderer
- No telemetry, no content logging, no cloud sync
- Translation history is local only

See [docs/security.md](docs/security.md).

---

## License

[MIT](LICENSE)
