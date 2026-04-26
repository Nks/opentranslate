# AGENTS.md

# Project instructions

When a task spans multiple files, domains, or requires research/planning:
1. Use Ruflo memory search first to find existing patterns and prior decisions.
2. Use Ruflo orchestration/swarm only for planning, coordination, and memory.
3. Use Claude Code native tools for all file edits, code generation, shell commands, and tests.
4. Store final architectural decisions and useful implementation patterns back into Ruflo memory.
5. Each feature must be in a separated git branch
6. Follow gitflow branching model
7. Work in TDD mode

Do not use Ruflo as an executor for file writes or shell commands.

## Purpose

This document defines the mandatory rules for all coding agents, contributors, and automation working in the **OpenTranslate Desktop** repository.

The goal of this repository is to build a **MIT-licensed desktop translator** with a **two-pane translator UX** using:

- **Electron**
- **Nuxt 4**
- **Nuxt UI**
- **TypeScript**

Supported providers:

- **Google Cloud Translation**
- **LibreTranslate**

This file is normative. Agents must follow it when reading, planning, implementing, testing, refactoring, and documenting changes.

---

## Product Boundary

This repository builds a **desktop client only**.

It does **not** build, bundle, fork, embed, or redistribute a translation server.

The product scope is limited to:

- text translation
- source language auto-detection
- target language selection
- provider switching
- quick translation from any app via shortcut
- local translation history
- document translation only when supported by the active provider
- local settings and credential configuration
- desktop packaging for macOS, Windows, and Linux

Out of scope unless explicitly added to the specification:

- OCR
- speech features
- browser extension
- cloud account system
- sync
- team/admin tooling
- enterprise provider-specific features in the common UI
- embedded translation engines inside Electron

---

## Source of Truth

When conflicts exist, follow this order:

1. `AGENTS.md`
2. current approved product specification [opentranslate-desktop-spec.md](docs/opentranslate-desktop-spec.md)
3. current approved PRD [opentranslate-desktop-prd.md](docs/opentranslate-desktop-prd.md)
4. repository code
5. implementation convenience

If implementation convenience conflicts with architecture or security, architecture and security win.

---

## Required Engineering Principles

All agents must follow these principles.

### 1. Preserve product scope

Do not introduce new product capabilities outside the approved specification.

### 2. Preserve provider-neutral UX

The main user workflow must remain consistent regardless of whether the active provider is Google Cloud Translation or LibreTranslate.

### 3. Keep secrets out of renderer

Credentials, API keys, endpoint secrets, and sensitive provider configuration must never be exposed directly to the renderer.

### 4. Keep provider communication in Electron main

All network communication with translation providers must happen in Electron main process or a main-process-owned service layer.

### 5. Prefer explicitness over magic

Use explicit types, explicit error categories, explicit state transitions, and explicit capability checks.

### 6. Do not fake provider capabilities

If a provider does not support a feature, the UI must show that clearly. Do not emulate support through undefined or misleading behavior.

### 7. Keep MIT boundary clean

Do not add code or packaging decisions that would force the application to bundle non-MIT server components into the client distribution.

---

## Stack Rules

### Runtime

- Electron is the desktop runtime.
- Nuxt 4 is the renderer framework.
- Nuxt UI is the UI component layer.
- TypeScript is required everywhere.

### Allowed Languages

- TypeScript
- JSON
- Markdown
- minimal shell scripts when needed for packaging or CI

Do not introduce another frontend framework.

Do not introduce a separate backend service into this repository unless the specification is amended.

---

## Mandatory Architecture Rules

## 1. Layering

The repository must preserve these boundaries:

### Electron main process

Responsible for:

- app lifecycle
- windows
- global shortcuts
- clipboard reads
- provider HTTP calls
- file system operations
- credential access
- document translation workflow
- secure storage access
- diagnostic logging

### Preload layer

Responsible for:

- narrow typed IPC bridge
- exposing only approved functions to renderer

### Nuxt renderer

Responsible for:

- UI only
- view state
- user interaction
- display of translation results
- settings forms
- history screens
- document screen UI

### Shared domain layer

Responsible for:

- types
- provider contracts
- validation schemas
- error enums
- capability models

## 2. Forbidden architecture shortcuts

Agents must not:

- call provider APIs directly from Vue/Nuxt components
- store provider secrets in plain renderer state
- bypass preload by enabling unsafe renderer features
- duplicate provider logic inside UI components
- hardcode language lists in UI
- hardcode provider support for document translation without capability checks

---

## Security Rules

These rules are mandatory and non-negotiable.

1. `contextIsolation` must remain enabled.
2. `nodeIntegration` must remain disabled in the renderer.
3. Renderer must never access provider credentials directly.
4. All credentials must be read and used only in Electron main or a secure main-owned service.
5. Logs must redact secrets.
6. Clipboard contents may be read only after explicit quick-translate invocation.
7. Do not add hidden telemetry.
8. Do not log translation content by default.

Any code change that weakens these rules must be rejected.

---

## Provider Rules

## Shared provider contract

Every provider implementation must conform to the shared provider interface.

Required capabilities:

- health check
- supported-language discovery
- source-language detection
- text translation
- document translation capability check
- document translation only when supported
- structured capability reporting

## Google Cloud Translation rules

- Keep implementation isolated in a dedicated provider module.
- Support only the flows defined in the specification.
- Keep credentials handling in the main process.
- Normalize responses into shared types.
- Map provider-specific errors into shared error categories.

## LibreTranslate rules

- Support configurable endpoint.
- Support optional API key.
- Validate endpoint shape before enabling provider.
- Treat document translation as capability-gated.
- Do not assume any custom deployment behaves exactly like another deployment.

## Capability rules

Never infer support from configuration alone.

A provider feature is considered available only when:

1. configuration is valid
2. provider reports or demonstrates support
3. the app capability model marks it as enabled

---

## UI / UX Rules

The product must remain a two-pane translator in workflow, not visually cloned pixel-by-pixel from any specific vendor.

Agents must preserve:

- two-pane translation flow
- immediate translation behavior
- minimal friction copy workflow
- visible provider selection
- visible source/target language controls
- quick-translate popup experience
- local history access
- clear disabled states for unsupported features

Agents must avoid:

- turning translation into a multi-step form flow
- forcing provider-specific UI branches into the main path unless required
- bloating the interface with low-value controls
- hiding critical state such as active provider or error state

---

## State Management Rules

1. Keep business logic out of presentation components.
2. Keep provider responses normalized before UI consumption.
3. Persist only what is required.
4. Separate sensitive configuration from standard UI settings.
5. Ensure only the latest translation request can win the UI state update.
6. Cancel stale in-flight requests whenever appropriate.

---

## History Rules

History is local only.

Agents must preserve the following behavior:

- a successful text translation creates a history entry
- history stores source text, translated text, source language, target language, provider, timestamp
- history can be cleared
- history can be disabled
- history entries can be reopened into the editor

Do not add cloud synchronization.

---

## Document Translation Rules

1. The document screen must always reflect real provider capability.
2. If document translation is unsupported, the UI must remain honest and disabled.
3. File processing must happen through Electron main.
4. Do not transform provider-returned translated files unless the specification explicitly requires it.
5. Preserve original file content boundaries and output integrity.

---

## Language Rules

1. Do not hardcode supported languages in UI code.
2. Fetch provider-supported languages through the provider adapter.
3. Normalize all languages into shared internal structures.
4. If a selected language becomes invalid after provider switch, reset it safely.

---

## Error Handling Rules

All provider and app failures must map to explicit categories.

Minimum normalized categories:

- network unavailable
- endpoint unreachable
- TLS/certificate error
- authentication failure
- unsupported language
- unsupported document type
- quota exceeded
- rate limited
- invalid provider response
- internal app error

Agents must not throw raw provider errors directly into UI.

UI must receive normalized, typed, user-displayable errors.

---

## Testing Rules

No meaningful feature is complete without tests.

### Required test layers

#### Unit tests

Required for:

- provider adapters
- validators
- normalization logic
- error mappers
- settings storage
- history storage
- capability checks

#### Integration tests

Required for:

- Google adapter flows
- LibreTranslate adapter flows
- provider switching
- settings validation
- document translation orchestration

#### End-to-end tests

Required for:

- app launch
- text translation flow
- quick translate popup
- history behavior
- settings persistence
- provider switching
- capability-gated document flow

### Testing discipline

Agents must not:

- mark untested code as complete
- remove tests to make builds pass
- weaken assertions to hide regressions

---

## Code Quality Rules

1. Use TypeScript strictly.
2. Avoid `any` unless there is a documented reason.
3. Prefer small modules with explicit responsibilities.
4. Do not duplicate provider logic.
5. Keep components focused on rendering and interaction.
6. Keep side effects centralized.
7. Prefer typed schemas for settings and provider configs.
8. Prefer composition over inheritance.
9. Favor predictable data flow over hidden convenience abstractions.

---

## Repository Change Rules

When changing the repository, agents must:

1. keep directory structure coherent
2. update docs when behavior changes
3. update tests with code changes
4. avoid unrelated refactors in feature work
5. keep commits and patches scoped to the requested problem

If a change requires architectural deviation, the agent must document:

- why current architecture is insufficient
- what boundary changes are required
- what new risks are introduced

---

## Documentation Rules

Documentation is part of the product.

Agents must update relevant docs when changing:

- provider configuration
- security model
- packaging
- setup steps
- public behavior
- environment or credential requirements

Minimum documentation quality:

- concise
- implementation-accurate
- no fake placeholders
- no stale examples

---

## Forbidden Changes Without Explicit Approval

Do not do any of the following unless explicitly requested:

1. add telemetry
2. add cloud sync
3. add server code into this repository
4. add OCR or voice features
5. add browser extension support
6. add third provider beyond Google Cloud Translation and LibreTranslate
7. weaken security settings
8. change license away from MIT
9. introduce direct renderer network calls to providers
10. introduce persistent logging of translation content by default

---

## Preferred Implementation Order

When building from scratch or planning larger tasks, follow this order:

1. shared types and provider contract
2. secure Electron shell and preload bridge
3. settings storage and credential handling
4. provider adapters
5. main translation window
6. quick translate popup
7. history
8. document screen
9. packaging
10. tests and docs hardening

---

## Definition of Done

A task is done only when all of the following are true:

1. implementation matches the specification
2. architecture boundaries remain intact
3. security rules are preserved
4. code is typed
5. tests are added or updated
6. docs are updated where needed
7. no fake capabilities are exposed
8. no unrelated regressions are introduced

---

## Agent Behavior Expectations

When an agent receives a task, it should:

1. identify which product area is affected
2. identify which architecture layer is allowed to change
3. check whether the requested change is in scope
4. implement the smallest correct solution
5. add or update tests
6. update docs if behavior changed

Agents should prefer conservative, correct changes over broad rewrites.

---

## Final Rule

If there is uncertainty, choose the path that best preserves:

1. security
2. product scope
3. provider-neutral UX
4. maintainability
5. honesty of capability reporting

Do not optimize for speed at the cost of architecture, security, or product integrity.
