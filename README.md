# OpenTranslate Desktop

MIT-licensed desktop translator with a DeepL-style workflow.

Built with:

- **Electron**
- **Nuxt 4**
- **Nuxt UI**
- **TypeScript**

Supported providers:

- **Google Cloud Translation**
- **LibreTranslate**

---

## Overview

OpenTranslate Desktop is a cross-platform desktop application for:

- text translation
- source-language auto-detection
- target-language selection
- quick translation from any app via shortcut
- local translation history
- document translation when supported by the active provider
- provider switching between Google Cloud Translation and LibreTranslate

The product is a **desktop client only**.

It does **not** bundle or redistribute a translation server.

---

## Product Goals

1. Reproduce the DeepL-style desktop translation workflow.
2. Keep the client fully open source under **MIT**.
3. Support **macOS**, **Windows**, and **Linux**.
4. Allow users to choose between a cloud provider and a self-hosted/open provider.
5. Keep secrets and provider communication out of the renderer.

---

## Core Features

- Two-pane translation UI
- Auto-detect source language
- Target language selector
- Language swap
- Quick translate popup
- Global shortcut translation flow
- Local translation history
- Provider switching
- Capability-gated document translation
- Light mode / dark mode

---

## Supported Providers

### Google Cloud Translation

Supported through a dedicated provider adapter.

Expected configuration:

- Google Cloud project ID
- credentials JSON file path
- API edition selection
- optional location for Advanced mode

### LibreTranslate

Supported through a dedicated provider adapter.

Expected configuration:

- API endpoint
- optional API key
- optional self-signed certificate mode
- provider health validation

LibreTranslate can be used with:

- public endpoint
- private hosted endpoint
- local/self-hosted deployment

---

## Architecture

The application is split into three layers.

### Electron main process

Responsible for:

- app lifecycle
- provider HTTP calls
- shortcut registration
- clipboard access
- file system access
- secure storage access
- document translation orchestration

### Preload bridge

Responsible for:

- typed IPC
- safe API exposure to renderer

### Nuxt renderer

Responsible for:

- UI
- interaction
- settings forms
- history screen
- document screen

### Security boundary

- `contextIsolation` enabled
- `nodeIntegration` disabled in renderer
- no direct provider calls from renderer
- no direct credential access in renderer

---

## Planned Repository Structure

```text
/app
/electron
/shared
/docs
/scripts
```

### Expected documentation files

```text
README.md
docs/architecture.md
docs/providers/google.md
docs/providers/libretranslate.md
docs/self-hosting/libretranslate.md
docs/packaging.md
docs/security.md
AGENTS.md
LICENSE
```

---

## Development Requirements

- Node.js LTS
- npm or pnpm
- desktop OS supported by Electron

Recommended:

- latest Node.js LTS
- pnpm for dependency management

---

## Quick Start

## 1. Install dependencies

Using npm:

```bash
npm install
```

Using pnpm:

```bash
pnpm install
```

## 2. Run development mode

Using npm:

```bash
npm run dev
```

Using pnpm:

```bash
pnpm dev
```

## 3. Build production app

Using npm:

```bash
npm run build
```

Using pnpm:

```bash
pnpm build
```

## 4. Package desktop installers

Using npm:

```bash
npm run package
```

Using pnpm:

```bash
pnpm package
```

---

## Required Scripts

The repository must provide these scripts:

```json
{
  "dev": "...",
  "build": "...",
  "package": "...",
  "lint": "...",
  "typecheck": "...",
  "test": "...",
  "test:e2e": "..."
}
```

---

## Configuration

## Google Cloud Translation

Required configuration fields:

- project ID
- credentials JSON path
- API edition
- location when required
- request timeout

## LibreTranslate

Required configuration fields:

- endpoint URL
- optional API key
- request timeout
- allow self-signed certificate toggle

Provider configuration must be handled in **Electron main**, not in the renderer.

---

## Quick Translate

Default shortcuts:

- **macOS:** `Command + C + C`
- **Windows:** `Ctrl + C + C`
- **Linux:** `Ctrl + C + C`

Rules:

- normal copy must behave normally
- clipboard is read only after explicit quick-translate invocation
- popup must allow copying translated text
- popup must allow opening the full app

---

## History

History is local only.

Each successful translation should produce a history entry containing:

- source text
- translated text
- source language
- target language
- provider
- timestamp

History must support:

- search
- reopen in editor
- delete single entry
- clear all
- disable completely

---

## Document Translation

Document translation is **capability-gated**.

That means:

- the UI may always show the document screen
- translation actions are enabled only when the active provider supports them
- the app must never fake document support

---

## Testing

The project requires three levels of testing.

### Unit tests

- provider adapters
- validators
- normalization logic
- settings storage
- history storage
- error mappers

### Integration tests

- Google provider flows
- LibreTranslate provider flows
- provider switching
- settings validation
- document translation orchestration

### End-to-end tests

- app launch
- translation flow
- quick translate popup
- history workflow
- settings persistence
- provider switching
- document capability gating

---

## Security Rules

The following rules are mandatory:

1. Do not expose provider secrets to renderer.
2. Do not call provider APIs directly from Vue/Nuxt components.
3. Keep all provider communication in Electron main.
4. Redact secrets from logs.
5. Do not enable telemetry by default.
6. Do not log translation content by default.

See also:

- `AGENTS.md`
- `docs/security.md`

---

## Product Boundaries

Out of scope unless the specification changes:

- OCR
- voice translation
- speech output
- browser extension
- cloud sync
- user accounts
- admin/team billing flows
- embedded translation server
- additional translation providers beyond Google Cloud Translation and LibreTranslate

---

## License

This repository is licensed under **MIT**.

Third-party providers and services keep their own licenses.

---

## Related Project Documents

- `AGENTS.md`
- `docs/architecture.md`
- `docs/providers/google.md`
- `docs/providers/libretranslate.md`
- `docs/self-hosting/libretranslate.md`
- `docs/packaging.md`
- `docs/security.md`

---

## Status

Project status: **Specification / PRD stage**

Primary documents already prepared:

- product specification
- PRD
- AGENTS.md
- repository README
