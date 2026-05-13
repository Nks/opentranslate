# AGENTS.md — OpenTranslate Desktop · Claude Code Configuration

File normative. Agents follow when reading, planning, implementing, testing, refactoring, documenting.

## Project Overview

**OpenTranslate Desktop** — MIT two-pane desktop translator. Electron main + Nuxt 4 SPA renderer + TypeScript everywhere. Talk Google Cloud Translation + LibreTranslate. No server — desktop client only.

| Area             | Stack                                                                        |
|------------------|------------------------------------------------------------------------------|
| Desktop runtime  | Electron 41 (`contextIsolation: true`, `nodeIntegration: false`)             |
| Renderer         | Nuxt 4 (SPA mode, `ssr: false`) + Nuxt UI                                    |
| Language         | TypeScript strict, `declare(strict)` not applicable — TS strict mode         |
| Bundler          | esbuild (electron main/preload), Vite (renderer)                             |
| Packaging        | electron-builder (npmRebuild + asarUnpack for `.node`)                       |
| State            | Pinia stores in renderer; per-process service classes in main                |
| Storage          | better-sqlite3 (history), file-backed JSON (settings), safeStorage (secrets) |
| Global shortcuts | uiohook-napi (N-API, ABI-stable prebuilds)                                   |
| Tests            | vitest (unit/integration), Playwright (e2e)                                  |
| Lint / typecheck | ESLint + @stylistic, `tsc --noEmit`                                          |
| Package manager  | pnpm 10                                                                      |
| Branching        | gitflow — feature branches off `develop`, PR into `develop`                  |
| Workflow         | TDD — write failing test, then code, then refactor                           |

Providers: **Google Cloud Translation**, **LibreTranslate**. No third provider unless `AGENTS.md` amended.

## Project Structure

```
electron/                       # Electron main + preload (Node ABI, full filesystem/network)
  main/                         # app lifecycle, windows, shortcuts, IPC wiring, CSP
  preload/                      # narrow typed IPC bridge (contextBridge)
  providers/                    # google/, libretranslate/, registry.ts (descriptors + adapters)
  services/                     # history/, settings/, secrets/, translation/, language-catalog/,
                                #   quick-translate/, shortcuts/, http/, documents/, ipc/
  ipc/channels.ts               # SINGLE source of truth for main↔renderer channels
shared/                         # types/, errors/, schemas/, providers/, translation/, shortcuts/
  capability-gate.ts            # config × provider-report × app-model triple check
  index.ts                      # public shared barrel
app/                            # Nuxt 4 renderer (`srcDir: app/`) — UI only
  pages/                        # index.vue, history.vue, settings.vue, documents.vue, overlay.vue
  components/                   # Vue SFCs — render-only, no provider/IO logic
  composables/                  # useApi, useTranslation, useHistory, useHandleError, …
  stores/                       # Pinia: providers, settings, translation, history
  assets/css/                   # Tailwind 4 entry
tests/
  unit/                         # vitest, fast — store mocks at boundary (HistoryStore, etc.)
  integration/                  # vitest — provider adapter HTTP via msw / undici
  e2e/                          # Playwright — full electron app, real renderer
  setup/                        # vitest setup
scripts/
  dev.mjs                       # esbuild watch + nuxt dev + electron launch (port 3344)
  build-electron.mjs            # esbuild prod bundle for main + preload
  package.mjs                   # build:electron + build:renderer + electron-builder
docs/
  opentranslate-desktop-spec.md # approved specification (SoT #2)
  opentranslate-desktop-prd.md  # approved PRD (SoT #3)
  architecture.md packaging.md security.md state.md backlog.md
  providers/  self-hosting/  tasks/
.claude/  .claude-flow/  .mcp.json   # claude-flow / RuFlo configuration
electron-builder.yml            # packaging config (asarUnpack '**/*.{node,dll}')
nuxt.config.ts                  # SPA, `experimental.viteEnvironmentApi: true`
package.json                    # `postinstall: electron-rebuild -f -o better-sqlite3`
```

### IPC Surface (`electron/ipc/channels.ts` — single source of truth)

| Channel                                       | Direction       | Purpose                                        |
|-----------------------------------------------|-----------------|------------------------------------------------|
| `app:get-version`, `app:get-platform`         | renderer → main | runtime metadata                               |
| `providers:list`, `provider:switch`           | renderer → main | provider registry + active selection           |
| `settings:get/update/reset`                   | renderer → main | persisted app + provider settings              |
| `secrets:set`, `secrets:test`                 | renderer → main | safeStorage round-trip (no `secrets:get` ever) |
| `translation:translate/cancel/detect`         | renderer → main | text + detection flows                         |
| `language:list`                               | renderer → main | provider-discovered language catalog           |
| `history:add/list/search/delete/clear/toggle` | renderer → main | local sqlite history                           |
| `document:pick/translate/status`              | renderer → main | document workflow (capability-gated)           |

Renderer call providers only through channels. No fetch to translation APIs from Vue.

### Conventions

- TypeScript strict, no `any` without documented reason.
- One responsibility per file. Pages orchestrate; composables coordinate; components render; services own side-effects.
- Provider responses normalize to shared types before reaching UI.
- New provider feature = (1) shared contract entry, (2) adapter, (3) capability gate, (4) tests, (5) doc update.
- Lint with `pnpm lint` before every commit. Curly braces always. Same-name shorthand in Vue.

## Build, Test & Dev

```bash
pnpm install              # postinstall rebuilds better-sqlite3 against current Electron ABI
pnpm dev                  # esbuild watch + nuxt dev + electron launch
pnpm test                 # vitest run (unit + integration)
pnpm test:watch           # vitest interactive
pnpm test:e2e             # playwright (auto-builds electron bundle first)
pnpm run typecheck        # tsc --noEmit
pnpm run lint             # eslint .
pnpm run lint:fix         # eslint --fix
pnpm run build            # typecheck + build:electron + build:renderer
pnpm run package          # full installer for current OS (release/)
pnpm run package:dir      # unpacked dir output for inspection
```

- ALWAYS run `pnpm test` after code changes.
- ALWAYS run `pnpm lint` + `pnpm run typecheck` before committing.
- Native modules (`better-sqlite3`, `uiohook-napi`) need ABI match — `postinstall` handles Electron rebuild; uiohook-napi N-API prebuilds load directly.

## Source of Truth

Conflict order:

1. `AGENTS.md`
2. `docs/opentranslate-desktop-spec.md` — approved spec
3. `docs/opentranslate-desktop-prd.md` — approved PRD
4. repository code
5. implementation convenience

Implementation convenience vs architecture/security → architecture + security win.

---

## Mandatory Workflow — HARD CONSTRAINT

**claude-flow mandatory. Every non-trivial task MUST run loop below. No exceptions, no bypass.**

`.mcp.json` provisions claude-flow in `v3` mode, `hierarchical-mesh` topology, 15 agents, hybrid memory, hooks enabled. Start daemon if needed: `npx @claude-flow/cli@latest daemon start`. Heal: `npx @claude-flow/cli@latest doctor --fix`.

### The Loop (every task)

1. **Analyze task.** Read prompt + relevant code + memory. `memory_search_unified` for prior decisions/patterns. `hooks_pre-task` to register.
2. **Ask clarifying questions.** Before code, surface ambiguity to user. No guess scope, error categories, UX behavior, persistence semantics.
3. **Spawn `coder` agent** (Agent tool, `run_in_background: true`). Provide: task scope, acceptance criteria, files to touch, file-size cap (≤500 lines), DRY/SOLID/Clean-Architecture expectations, test layer required.
4. **Spawn `reviewer` agent** (Agent tool). Provide: diff under review, AGENTS.md rules, security boundary checks (no provider calls in renderer, no `secrets:get`, no plaintext credentials, etc.).
5. **Repeat coder + reviewer** until reviewer signs off. Coder fixes findings; reviewer re-reads diff. No merge until reviewer clean.
6. **Security audit.** Spawn `security-auditor` (or `security-architect`) agent. Run `aidefence_scan` on diff. Check threat surface (IPC, file paths, secrets, redaction).
7. **Fix security issues immediately.** Loop coder + security-auditor until zero findings.
8. **Repeat loop** for any rework from review or audit.
9. **`hooks_post-task`** to record outcome + persist learnings via `memory_store`.

### Sub-rules

- All Agent tool calls in single message when independent (parallel).
- Use `run_in_background: true` for Agent calls. After spawn, STOP — no poll, no status-check.
- Claude Code's Agent tool for EXECUTION (file edits, code, tests, git). MCP tools for COORDINATION (memory, hooks, swarm, routing).
- Discover MCP tools via `ToolSearch` before assume tool unavailable.
- Honor `[INTELLIGENCE]` pattern suggestions in `system-reminder` tags before start.
- One feature = one git branch off `develop` (gitflow). PR targets `develop`.
- TDD: failing test first, then implementation. Tests not optional.

### 3-Tier Model Routing (ADR-026)

| Tier | Handler              | Latency | Cost         | Use Cases                                                   |
|------|----------------------|---------|--------------|-------------------------------------------------------------|
| 1    | Agent Booster (WASM) | <1ms    | $0           | Trivial transforms (rename, add types) — Edit tool directly |
| 2    | Haiku                | ~500ms  | $0.0002      | Simple tasks, low complexity (<30%)                         |
| 3    | Sonnet / Opus        | 2-5s    | $0.003-0.015 | Complex reasoning, architecture, security (>30%)            |

### Available agents

Core: `coder`, `reviewer`, `tester`, `planner`, `researcher`. Specialized: `security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`. Coordination: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`. GitHub: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`.

### Memory & MCP discovery

| Tool                                           | Use                                                              |
|------------------------------------------------|------------------------------------------------------------------|
| `memory_search_unified`                        | Search Claude memories + AgentDB + patterns before starting      |
| `memory_store`                                 | Persist architectural decisions, error fixes, recurring patterns |
| `memory_retrieve` / `memory_list`              | Recall by key / scan namespace                                   |
| `hooks_route`                                  | Route a task to the right handler                                |
| `hooks_pre-task` / `hooks_post-task`           | Lifecycle hooks for trajectory + learning                        |
| `aidefence_scan`                               | Prompt-injection + secret scan on diff or input                  |
| `swarm_init` / `swarm_status` / `swarm_health` | Coordination plane                                               |

```
ToolSearch("memory search")     → memory_store, memory_search, memory_search_unified
ToolSearch("swarm")             → swarm_init, swarm_status, swarm_health, swarm_shutdown
ToolSearch("+aidefence")        → aidefence_scan, aidefence_is_safe, aidefence_has_pii
```

No claude-flow as executor for file writes or shell commands — Claude Code tools (Edit, Write, Bash) do that.

---

## Engineering Principles

1. **DRY.** Provider logic, error mapping, capability checks, language normalization — each exists once. Two places do same thing → extract.
2. **SOLID.**
  - Single responsibility per module / class / composable.
  - Open/closed — adding provider must not edit existing adapters.
  - Liskov — every provider adapter satisfies shared contract identically; UI never branches on provider id in main path.
  - Interface segregation — narrow IPC bridge in preload; narrow service ports.
  - Dependency inversion — main/preload depend on shared contracts, not concrete adapters.
3. **Clean Architecture.** Layers: `shared` ⟵ `electron` ⟵ `app`. Inner layers know nothing of outer. Renderer never imports from `electron/*`. Adapters depend on `shared`, never vice versa.
4. **Files ≤500 lines** of code. Hard cap. Split before cross: pages orchestrate, services/components/composables render.
5. **Explicit over magic.** Explicit types, error categories, state transitions, capability checks. No clever inference.
6. **No fake capabilities.** Provider lacks feature → UI shows disabled with clear reason. Never emulate support.
7. **Tests first, tests always.** TDD. Boundary mocks (mock `HistoryStore` interface, not better-sqlite3). E2E covers reality.

---

## Response Style — Ultra Caveman (Always Enforced)

All user-facing responses MUST be ultra-caveman. No exceptions, no drift, no revert across turns. Off only on explicit `stop caveman` / `normal mode`.

**Drop:**
- Articles (`a`, `an`, `the`)
- Filler (`just`, `really`, `basically`, `actually`, `simply`, `essentially`, `generally`)
- Pleasantries (`sure`, `certainly`, `of course`, `happy to`, `I'll help`, `let me`)
- Hedging (`might`, `could`, `perhaps`, `I think`, `it would be good to`)
- Connective fluff (`however`, `furthermore`, `additionally`, `that said`)
- Subjects when implied. Verbs in imperative. Fragments preferred.
- Trailing summaries of what was already shown in tool output.

**Pattern:** `[thing] [action] [reason]. [next step].`

- Not: "I'll go ahead and update the config file because the linter is complaining about the missing trailing comma."
- Yes: "Lint fail: missing trailing comma. Fix config."

**Shortest words.** `fix` not `implement a solution for`, `big` not `extensive`, `use` not `utilize`, `run` not `execute`, `add` not `incorporate`.

**Preserve exactly (never compress):**
- Code, commands, file paths, URLs, error strings (quote verbatim)
- Commit messages, PR titles/bodies, changelog entries
- Security warnings, irreversible-action confirmations
- Multi-step sequences where fragment order risks misread
- User-asked clarification / repeated questions — drop caveman, answer plainly, resume after

**Resume caveman after every clear-text section.**

**End-of-turn summary:** one fragment. State result + next step. Nothing else.

## Behavioral Rules (Always Enforced)

- Do what asked; nothing more, nothing less.
- NEVER create files unless absolutely necessary. Prefer editing.
- NEVER proactively create documentation (`*.md`, README) unless explicitly requested.
- NEVER save working files / tests / mds to repo root. Use `electron/`, `app/`, `shared/`, `tests/`, `docs/`, `scripts/`.
- ALWAYS read file before editing.
- NEVER commit secrets, credentials, or `.env` files.
- NEVER commit without explicit user approval.
- NEVER add `Co-Authored-By: claude-*` or AI attribution lines to commits/PRs.
- After spawn swarm, STOP — no poll. Trust agents to return.

---

## Product Boundary

In scope: text translation, source auto-detect, target selection, provider switching, quick-translate via global shortcut, local history, document translation **only when** active provider supports, local settings + credentials, packaging for macOS / Windows / Linux.

Out of scope (without explicit spec amendment): OCR, speech, browser extension, cloud account system, sync, team/admin tooling, enterprise provider-specific features in common UI, embedded translation engines.

Repo does **not** build, bundle, fork, embed, redistribute translation server.

---

## Architecture — Mandatory Layering

**Electron main process** — app lifecycle, windows, global shortcuts, clipboard, provider HTTP, file I/O, credential access, document workflow, secure storage, logging.

**Preload** — narrow typed IPC bridge. Exposes only approved channel functions to renderer via `contextBridge`.

**Renderer (Nuxt)** — UI only. View state, user interaction, display, settings forms, history screens, document UI.

**Shared** — types, provider contracts, validation schemas, error enums, capability models.

### Forbidden architecture shortcuts

- Call provider APIs directly from Vue/Nuxt components.
- Store provider secrets in plain renderer state.
- Bypass preload via unsafe renderer features.
- Duplicate provider logic inside UI components.
- Hardcode language lists in UI.
- Hardcode document-translation support without capability check.

---

## Security Rules (mandatory, non-negotiable)

1. `contextIsolation` enabled, `nodeIntegration` disabled, sandbox where possible.
2. Renderer never accesses provider credentials directly. No `secrets:get` IPC channel exists or will exist.
3. All credentials read + used only in Electron main or main-owned service. safeStorage round-trip only.
4. Logs must redact secrets and (by default) translation content.
5. Clipboard read only after explicit quick-translate invocation.
6. No hidden telemetry.
7. Validate user input + IPC payloads at boundary with shared schemas (zod). Sanitize file paths.
8. CSP locked in `electron/main/csp.ts`. No remote code execution in renderer.

Code change weakens these → rejected.

---

## Provider Rules

Every adapter implements shared contract: health check, language discovery, source-language detection, text translation, document-translation capability check, document translation only when supported, structured capability reporting.

- **Google Cloud Translation** — dedicated module, credentials in main, normalize responses, map errors to shared categories.
- **LibreTranslate** — configurable endpoint, optional API key, validate endpoint shape, capability-gate document translation, no assume parity between deployments.
- **Capability** — feature available only when: (1) config valid, (2) provider reports/demonstrates support, (3) app capability model marks enabled.

---

## UI / UX Rules

Two-pane translator workflow. Not pixel-clone of any vendor. Preserve: two-pane flow, immediate translation, minimal-friction copy, visible provider selector, visible source/target language controls, quick-translate popup, local history access, clear disabled states. Avoid: multi-step form flows, provider-specific UI branches in main path, low-value controls, hide critical state (active provider, error).

## State Management

Business logic out of presentation components. Normalize provider responses before UI consumption. Persist only required. Separate sensitive config from standard UI settings. Latest translation request wins state; cancel stale in-flight requests.

## History

Local only. Successful text translation creates entry storing source, translation, source lang, target lang, provider, timestamp. History can clear, can disable, entries reopen into editor. No cloud sync.

## Document Translation

UI reflects real provider capability. Unsupported = disabled, not faked. File I/O in main. No transform provider-returned files unless spec requires. Preserve original content boundaries.

## Language

No hardcode supported languages. Fetch via adapter. Normalize to shared structures. Reset selection safely if invalid after provider switch.

## Error Handling

Normalize all failures into explicit shared categories: network unavailable, endpoint unreachable, TLS/cert, auth, unsupported language, unsupported document type, quota exceeded, rate limited, invalid provider response, internal app error. Never throw raw provider errors into UI. UI receives normalized, typed, user-displayable errors only.

---

## Testing Rules

| Layer       | Required for                                                                                                                           |
|-------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Unit        | provider adapters, validators, normalization, error mappers, settings storage, history store, capability checks                        |
| Integration | Google + LibreTranslate flows, provider switching, settings validation, document orchestration                                         |
| E2E         | app launch, text translation, quick-translate popup, history, settings persistence, provider switching, capability-gated document flow |

No mark untested code complete. No remove tests to make builds pass. No weaken assertions to hide regressions. Native modules mocked at interface boundary in unit tests; real DB exercised in E2E.

---

## Code Quality

TypeScript strict. Avoid `any` unless documented. Small modules, explicit responsibility. No duplicated provider logic. Components render and interact — that it. Side effects centralized in services / composables. Typed zod schemas for settings + provider configs. Composition over inheritance. Predictable data flow over hidden convenience.

Hard rules from past feedback:

- No silent catch blocks — every `catch (err: unknown)` surfaces via `useHandleError`/`useToast`.
- Explicit TS types on every variable, parameter, return, catch.
- `withDefaults(defineProps<Props>(), {...})` not destructured prop defaults.
- Vue v-model uses `defineModel()` (Vue 3.4+), not VueUse `useVModel`.
- Curly braces on every `if/else/for/while` body.
- No one-char var names (`event`, `index`, not `e`, `i`).
- Same-name shorthand in Vue templates (`:foo` not `:foo="foo"`).
- `useApi()` hoisted once at top of setup, never per method.
- No redundant `Ref<T>` annotations — `ref<T>(...)` already returns `Ref<T>`.
- Pages orchestrate, child components render. Extract coherent template regions into reusable components.

---

## Repository Change Rules

Keep directory structure coherent. Update docs when behavior changes. Update tests with code changes. Avoid unrelated refactors in feature work. Keep commits scoped. Update `docs/state.md` after each phase/iteration when status, branch, tests, decisions, deferred items change.

Change needs architectural deviation → document why current architecture insufficient, what boundary changes required, what new risks introduced.

---

## Forbidden Changes (without explicit approval)

1. Telemetry. 2. Cloud sync. 3. Server code in this repo. 4. OCR / voice. 5. Browser extension. 6. Third provider beyond Google + LibreTranslate. 7. Weaken security settings. 8. Change license away from MIT. 9. Direct renderer network calls to providers. 10. Persistent logging of translation content by default.

---

## Preferred Implementation Order

New top-level work: (1) shared types + provider contract, (2) secure Electron shell + preload bridge, (3) settings + credential handling, (4) provider adapters, (5) main translation window, (6) quick-translate popup, (7) history, (8) document screen, (9) packaging, (10) tests + docs hardening.

---

## Definition of Done

1. Implementation matches spec. 2. Architecture boundaries intact. 3. Security rules preserved. 4. Code typed. 5. Tests added/updated. 6. Docs updated where needed. 7. No fake capabilities exposed. 8. No unrelated regressions. 9. Loop completed (coder + reviewer + security all green). 10. `docs/state.md` reflects current phase.

---

## Final Rule

Uncertainty → choose path that best preserves, in this order:

1. Security
2. Product scope
3. Provider-neutral UX
4. Maintainability
5. Honesty of capability reporting

No optimize for speed at cost of architecture, security, product integrity.