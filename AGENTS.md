# AGENTS.md — OpenTranslate Desktop · Claude Code Configuration

File normative. Agents follow when reading, planning, implementing, testing, refactoring, documenting.

## Project Overview

**OpenTranslate Desktop** — MIT two-pane desktop translator. Electron main + Nuxt 4 SPA renderer + TypeScript everywhere. Talks Google Cloud Translation + LibreTranslate. No server — desktop client only.

| Area             | Stack                                                                        |
|------------------|------------------------------------------------------------------------------|
| Desktop runtime  | Electron 41 (`contextIsolation: true`, `nodeIntegration: false`)             |
| Renderer         | Nuxt 4 (SPA mode, `ssr: false`) + Nuxt UI                                    |
| Language         | TypeScript strict mode                                                       |
| Bundler          | esbuild (electron main/preload), Vite (renderer)                             |
| Packaging        | electron-builder (npmRebuild + asarUnpack for `.node`)                       |
| State            | Pinia stores in renderer; per-process service classes in main                |
| Storage          | better-sqlite3 (history), file-backed JSON (settings), safeStorage (secrets) |
| Global shortcuts | uiohook-napi (N-API, ABI-stable prebuilds)                                   |
| Tests            | vitest (unit/integration), Playwright (e2e)                                  |
| Lint / typecheck | ESLint + @stylistic, `tsc --noEmit`                                          |
| Package manager  | pnpm 10                                                                      |
| Branching        | gitflow — feature branches off `develop`, PR into `develop`                  |
| Workflow         | TDD — failing test first, then code, then refactor                           |

Providers: **Google Cloud Translation**, **LibreTranslate**. No third provider unless `AGENTS.md` amended.

## Project Structure

```
electron/   main/ preload/ providers/ services/ ipc/channels.ts (IPC source of truth)
shared/     types/ errors/ schemas/ providers/ translation/ shortcuts/ capability-gate.ts index.ts
app/        pages/ components/ composables/ stores/ assets/css/    (Nuxt SPA, srcDir: app/)
tests/      unit/ integration/ e2e/ setup/
scripts/    dev.mjs build-electron.mjs package.mjs
docs/       opentranslate-desktop-spec.md (SoT #2)  opentranslate-desktop-prd.md (SoT #3)
            architecture.md packaging.md security.md state.md backlog.md  providers/ self-hosting/ tasks/
.claude/  .claude-flow/  .mcp.json     # claude-flow / RuFlo — DO NOT TOUCH
electron-builder.yml  nuxt.config.ts  package.json
```

`electron/services/`: history, settings, secrets, translation, language-catalog, quick-translate, shortcuts, http, documents, ipc. `electron/providers/`: google, libretranslate, registry.ts.

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

Renderer calls providers only through channels. No fetch to translation APIs from Vue. Renderer imports from `electron/*` only via `import type` of IPC contract shapes.

### Conventions

- TypeScript strict, no `any` without documented reason.
- One responsibility per file. Pages orchestrate; composables coordinate; components render; services own side-effects.
- Provider responses normalize to shared types before reaching UI.
- New provider feature = (1) shared contract entry, (2) adapter, (3) capability gate, (4) tests, (5) doc update.
- Lint with `pnpm lint` before every commit. Curly braces always. Same-name shorthand in Vue.

## Build, Test & Dev

```bash
pnpm install        # postinstall rebuilds better-sqlite3 vs Electron ABI
pnpm dev            # esbuild watch + nuxt dev + electron launch
pnpm test           # vitest run (unit + integration)
pnpm test:e2e       # playwright (auto-builds electron bundle)
pnpm run typecheck  # tsc --noEmit
pnpm run lint       # eslint .       (--fix for autofix)
pnpm run build      # typecheck + build:electron + build:renderer
pnpm run package    # installer for current OS (release/)   (package:dir for unpacked)
```

ALWAYS `pnpm test` after code changes. ALWAYS `pnpm lint` + `pnpm run typecheck` before commit. Native modules (`better-sqlite3`, `uiohook-napi`) need ABI match — `postinstall` rebuilds.

## Source of Truth

Conflict order: 1. `AGENTS.md` · 2. `docs/opentranslate-desktop-spec.md` · 3. `docs/opentranslate-desktop-prd.md` · 4. repo code · 5. implementation convenience. Implementation convenience vs architecture/security → architecture + security win.

---

## Mandatory Workflow — HARD CONSTRAINT

**claude-flow MANDATORY for ALL ongoing work. Non-negotiable.**

**Claude is the MANAGER, never the EXECUTOR.** Every non-trivial implementation, refactor, bugfix, test write, security audit, or doc rewrite routes through Agent tool subagents.

**Main thread MAY**: read files for context; run validation (`pnpm lint`, `pnpm test`, `pnpm run typecheck`, `git status`); spawn agents; review agent results; ask user clarifying questions (`AskUserQuestion`); edit trivial fixes (≤5 lines, no logic); update `docs/state.md` / task tracking.

**Main thread MUST NOT**: implement features; refactor multi-file changes; write tests; commit/push feature work; do hunk-splitting; write provider adapters; write UI components. All of those → spawned agents.

### Daemon

`.mcp.json` provisions claude-flow `v3` mode, `hierarchical-mesh` topology, 15 agents, hybrid memory, hooks enabled. Boot: `npx @claude-flow/cli@latest daemon start`. Heal: `npx @claude-flow/cli@latest doctor --fix`.

### The Loop — 7 steps, every task

1. **Plan.** `memory_search_unified` for prior decisions/patterns. Produce explicit file list + acceptance criteria. `hooks_pre-task` to register.
2. **Analyze.** Read relevant code. Surface design tradeoffs + architectural constraints.
3. **Ask.** Clarifying questions to user via `AskUserQuestion` BEFORE writing code — scope, error categories, UX behavior, persistence semantics, security tradeoffs.
4. **Code.** Spawn `coder` Agent (`run_in_background: true`). Provide: full file ownership list, acceptance tests, file-size cap (≤500 lines), DRY/SOLID/Clean Architecture expectations, no-comments policy, test layer required.
5. **Review code.** Spawn `reviewer` Agent on the diff. Check against AGENTS.md rules — security boundary, layering, DRY/SOLID, comment density, file size.
6. **Review security.** Spawn `security-auditor` (or `security-architect`) Agent + `aidefence_scan` on the diff. Audit IPC surface, file paths, credentials, redaction.
7. **Fix.** Spawn fix `coder` Agent for combined reviewer + security findings. Loop steps 4–7 until both reviewer and security report clean.

After loop closes: `hooks_post-task` + `memory_store` learnings.

### Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All Agent calls + tool calls in single message when independent (parallel).
- `run_in_background: true` for all Agent calls. After spawn, STOP — no poll, no status-check.
- Trust agents to return. Never poll status repeatedly.
- Batch all file reads/writes/edits/Bash in ONE message.

---

## RuFlo / claude-flow Tooling Reference

### Project Config

| Setting    | Value             |
|------------|-------------------|
| Topology   | hierarchical-mesh |
| Max agents | 15                |
| Memory     | hybrid            |
| HNSW       | enabled           |
| Neural     | enabled           |
| Consensus  | raft              |

### 3-Tier Model Routing (ADR-026)

| Tier | Handler              | Latency | Cost         | Use Cases                                                |
|------|----------------------|---------|--------------|----------------------------------------------------------|
| 1    | Agent Booster (WASM) | <1ms    | $0           | Trivial transforms (var→const, add types) — Skip LLM     |
| 2    | Haiku                | ~500ms  | $0.0002      | Simple tasks, low complexity (<30%)                      |
| 3    | Sonnet / Opus        | 2-5s    | $0.003-0.015 | Complex reasoning, architecture, security (>30%)         |

Tier 1: Edit tool directly. No LLM agent.

### Swarm Configuration & Anti-Drift

- ALWAYS hierarchical topology for coding swarms.
- maxAgents 6–8 for tight coordination on focused work; full 15 for broad refactors.
- `specialized` strategy for clear role boundaries.
- `raft` consensus for hive-mind (leader maintains authoritative state).
- Frequent checkpoints via `post-task` hooks.
- Shared memory namespace across all agents.

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### V3 CLI Commands

| Command     | Subcommands | Description                              |
|-------------|-------------|------------------------------------------|
| `init`      | 4           | Project initialization                   |
| `agent`     | 8           | Agent lifecycle management               |
| `swarm`     | 6           | Multi-agent swarm coordination           |
| `memory`    | 11          | AgentDB memory with HNSW search          |
| `task`      | 6           | Task creation and lifecycle              |
| `session`   | 7           | Session state management                 |
| `hooks`     | 17          | Self-learning hooks + 12 workers         |
| `hive-mind` | 6           | Byzantine fault-tolerant consensus       |

```bash
npx @claude-flow/cli@latest init --wizard
npx @claude-flow/cli@latest agent spawn -t coder --name translator-coder
npx @claude-flow/cli@latest swarm init --v3-mode
npx @claude-flow/cli@latest memory search --query "provider adapter error mapping"
npx @claude-flow/cli@latest doctor --fix
```

### Available Agents (16 roles + custom)

| Group              | Agents                                                                        |
|--------------------|-------------------------------------------------------------------------------|
| Core development   | `coder`, `reviewer`, `tester`, `planner`, `researcher`                        |
| Specialized        | `security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer` |
| Coordination       | `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`        |
| GitHub             | `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`         |

Any string usable as custom agent type — above are typed roles with specialized behavior.

### Memory & Vector Search

| MCP tool                | Description                                                  |
|-------------------------|--------------------------------------------------------------|
| `memory_store`          | Store value with ONNX 384-dim vector embedding               |
| `memory_search`         | Semantic vector search by query                              |
| `memory_retrieve`       | Get entry by key                                             |
| `memory_list`           | List entries in namespace                                    |
| `memory_delete`         | Delete entry                                                 |
| `memory_import_claude`  | Import Claude Code memories into AgentDB                     |
| `memory_search_unified` | Search across ALL namespaces (Claude + AgentDB + patterns)   |
| `memory_bridge_status`  | Show bridge health, vectors, SONA, intelligence              |

```bash
npx @claude-flow/cli@latest memory store \
  --key "pattern-provider-error-map" \
  --value "Google 401 → AUTH; LibreTranslate 429 → RATE_LIMITED" \
  --namespace translator/providers
npx @claude-flow/cli@latest memory search --query "history store boundary mock"
node .claude/helpers/auto-memory-hook.mjs import-all
```

Store decisions affecting `docs/state.md` (phase, branch, deferred items) and `docs/architecture.md`. Claude Code auto-memory files (`~/.claude/projects/*/memory/*.md`) auto-import into AgentDB with ONNX vector embeddings on session start; use `memory_search_unified` to search both.

### Key MCP tools (314 available — ToolSearch to discover)

| Category         | Tools                                                                | Purpose                                            |
|------------------|----------------------------------------------------------------------|----------------------------------------------------|
| Memory           | `memory_store`, `memory_search`, `memory_search_unified`             | Store/search with ONNX vector embeddings           |
| Claude bridge    | `memory_import_claude`, `memory_bridge_status`                       | Import Claude memories into AgentDB                |
| Swarm            | `swarm_init`, `swarm_status`, `swarm_health`                         | Multi-agent coordination                           |
| Agents           | `agent_spawn`, `agent_list`, `agent_status`                          | Agent lifecycle                                    |
| Hive-mind        | `hive-mind_init`, `hive-mind_spawn`, `hive-mind_consensus`           | Byzantine/Raft consensus                           |
| Hooks            | `hooks_route`, `hooks_session-start`, `hooks_post-task`              | Task routing + learning                            |
| Workers          | `hooks_worker-list`, `hooks_worker-dispatch`                         | 12 background workers                              |
| Security         | `aidefence_scan`, `aidefence_is_safe`                                | Prompt injection + secret detection                |
| Intelligence     | `hooks_intelligence`, `neural_status`                                | Pattern learning + SONA                            |

### Swarm capabilities

- **Topologies**: hierarchical (anti-drift), mesh, ring, star, adaptive.
- **Consensus**: Raft (leader-based), Byzantine (PBFT), Gossip (eventual).
- **Hive-Mind**: queen-led coordination — spawn, broadcast, consensus voting, shared memory.
- **12 background workers**: audit, optimize, testgaps, map, deepdive, document, refactor, benchmark, ultralearn, consolidate, predict, preload.

### Memory capabilities

- **ONNX embeddings**: all-MiniLM-L6-v2, 384 dim — real neural vectors.
- **DiskANN**: SSD-friendly vector search (8000× faster insert than HNSW, perfect recall at 1K).
- **sql.js**: cross-platform SQLite (WASM, no native compile).
- **Claude Code bridge**: auto-imports MEMORY.md files on session start.
- **Unified search**: `memory_search_unified` searches Claude memories + AgentDB + patterns.
- **SONA learning**: trajectory recording → pattern extraction → file persistence.

### Discover tools / quick setup

```
ToolSearch("memory search")  → memory_store, memory_search, memory_search_unified
ToolSearch("swarm")          → swarm_init, swarm_status, swarm_health, swarm_shutdown
ToolSearch("hive consensus") → hive-mind_consensus, hive-mind_status
ToolSearch("+aidefence")     → aidefence_scan, aidefence_is_safe, aidefence_has_pii
```

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

### Claude Code vs MCP tools

- **Claude Code Agent tool** = EXECUTION: agents, file ops, code generation, git.
- **MCP tools** (via ToolSearch) = COORDINATION: swarm, memory, hooks, routing, hive-mind.
- **CLI commands** (via Bash) = same tools, terminal output.
- Use `ToolSearch("keyword")` to discover MCP tools before assuming unavailable.
- Never use claude-flow as executor for file writes or shell commands — Claude Code tools (Edit, Write, Bash) do that.

---

## Engineering Principles — Enforced Every Step

Reviewer + security-auditor MUST fail the loop on violation.

1. **DRY.** Provider logic, error mapping, capability checks, language normalization — each exists once. Two places same thing → extract.
2. **SOLID.** Single responsibility per module/class/composable. Open/closed (adding provider must not edit existing adapters). Liskov (every adapter satisfies shared contract identically; UI never branches on provider id in main path). Interface segregation (narrow IPC bridge in preload; narrow service ports). Dependency inversion (main/preload depend on shared contracts, not concrete adapters).
3. **Clean Architecture.** Layers: `shared` ⟵ `electron` ⟵ `app`. Inner layers know nothing of outer. Renderer never imports from `electron/*` except `import type` of IPC contract shapes from `@electron/ipc/channels`. Inner layers (`shared/`) never reference outer (`electron/`, `app/`). Adapters depend on `shared`, never vice versa.
4. **One responsibility per file. Files ≤500 lines** hard cap. Split before crossing 400.
5. **Explicit over magic.** Explicit types, error categories, state transitions, capability checks. No clever inference.
6. **No fake capabilities.** Provider lacks feature → UI shows disabled with clear reason. Never emulate support.
7. **Tests first, tests always.** TDD. Boundary mocks (mock `HistoryStore` interface, not better-sqlite3). E2E covers reality.

---

## Code Style — NO Comments

**Code self-documenting. No comments.** Function and variable names carry intent.

**Allowed exceptions (rare)**: (a) JSDoc/TSDoc on PUBLIC exported APIs of shared modules where consumer cannot read the implementation; (b) single-line WHY note where reason non-obvious and would surprise a future reader, e.g. `// safeStorage round-trip required because Electron clears keychain on profile switch`.

**Forbidden**: WHAT comments (code shows what); task-reference comments (`// for B-017`, `// added for issue #42`); section banners (`// === Validation ===`); commented-out code; "stub" comments; narration of next line.

**Reviewer enforcement**: every PR diff passes comment-density review. Hunk adding >2 non-JSDoc comment lines → reviewer must justify each or remove. **Rename, extract a function, or introduce a typed enum INSTEAD OF leaving a comment.**

---

## Response Style — Ultra Caveman (Strengthened)

All user-facing text ultra-caveman by default. No drift across turns. No "in summary", "to recap", trailing paragraphs.

**Drop**: articles (`a`/`an`/`the`); filler (`just`, `really`, `basically`, `actually`, `simply`); pleasantries (`sure`, `certainly`, `happy to`, `I'll help`, `let me`); hedging (`might`, `could`, `perhaps`, `I think`); connective fluff (`however`, `furthermore`, `additionally`); subjects when implied; trailing summaries of tool output. Verbs imperative. Fragments preferred.

**Pattern**: `[thing] [action] [reason]. [next step].`

- Not: "I'll go ahead and update the config file because the linter is complaining about the missing trailing comma."
- Yes: "Lint fail: missing trailing comma. Fix config."

**Shortest words**: `fix` not `implement solution for`; `big` not `extensive`; `use` not `utilize`; `run` not `execute`; `add` not `incorporate`.

**Drop caveman only for**: security warnings; irreversible-action confirmations; multi-step lists where order matters; user asks "explain" / "clarify" / repeats; commit messages, PR bodies, code, error strings quoted verbatim. **Resume caveman immediately after cleartext section ends.**

**End-of-turn = one fragment**: `[result] [next step].` Period. Nothing else. Tables OK, markdown OK, code blocks unchanged.

---

## Behavioral Rules (Always Enforced)

- **MANDATORY: all ongoing work routes through Claude Flow.** No ad-hoc direct implementation. Non-negotiable.
- DO NOT modify `.claude/`, `.claude-flow/`, `.mcp.json` — RuFlo config, leave 100% as-is.
- Do what asked; nothing more, nothing less.
- NEVER create files unless absolutely necessary. Prefer editing existing.
- NEVER proactively create documentation (`*.md`, README) unless explicitly requested.
- NEVER save working files / tests / mds to repo root. Use `electron/`, `app/`, `shared/`, `tests/`, `docs/`, `scripts/`.
- ALWAYS read file before editing.
- NEVER commit secrets, credentials, or `.env` files.
- NEVER commit without explicit user approval.
- NEVER add `Co-Authored-By: claude-*` or AI attribution lines to commits/PRs.
- After spawn swarm, STOP — no poll. Trust agents to return.
- Honor `[INTELLIGENCE]` pattern suggestions in `system-reminder` tags before starting.

---

## Product Boundary

In scope: text translation, source auto-detect, target selection, provider switching, quick-translate via global shortcut, local history, document translation **only when** active provider supports, local settings + credentials, packaging for macOS / Windows / Linux.

Out of scope (without explicit spec amendment): OCR, speech, browser extension, cloud account system, sync, team/admin tooling, enterprise provider-specific features in common UI, embedded translation engines.

Repo does **not** build, bundle, fork, embed, redistribute translation server.

---

## Architecture — Mandatory Layering

- **Electron main** — app lifecycle, windows, global shortcuts, clipboard, provider HTTP, file I/O, credential access, document workflow, secure storage, logging.
- **Preload** — narrow typed IPC bridge via `contextBridge`. Exposes only approved channel functions.
- **Renderer (Nuxt)** — UI only. View state, user interaction, display, settings forms, history screens, document UI.
- **Shared** — types, provider contracts, validation schemas, error enums, capability models.

**Forbidden shortcuts**: call provider APIs directly from Vue/Nuxt; store provider secrets in plain renderer state; bypass preload via unsafe renderer features; duplicate provider logic inside UI components; hardcode language lists in UI; hardcode document-translation support without capability check.

---

## Security Rules (mandatory, non-negotiable)

1. `contextIsolation` enabled, `nodeIntegration` disabled, sandbox where possible.
2. Renderer never accesses provider credentials directly. No `secrets:get` IPC channel exists or will exist.
3. Credentials read + used only in Electron main or main-owned service. safeStorage round-trip only.
4. Logs redact secrets and (by default) translation content.
5. Clipboard read only after explicit quick-translate invocation.
6. No hidden telemetry.
7. Validate user input + IPC payloads at boundary with shared zod schemas. Sanitize file paths.
8. CSP locked in `electron/main/csp.ts`. No remote code execution in renderer.

Code change weakens these → rejected.

---

## Provider Rules

Every adapter implements shared contract: health check, language discovery, source-language detection, text translation, document-translation capability check, document translation only when supported, structured capability reporting.

- **Google Cloud Translation** — dedicated module, credentials in main, normalize responses, map errors to shared categories.
- **LibreTranslate** — configurable endpoint, optional API key, validate endpoint shape, capability-gate document translation, no assume parity between deployments.
- **Capability** — feature available only when: (1) config valid, (2) provider reports/demonstrates support, (3) app capability model marks enabled.

---

## UI / UX · State · History · Document · Language · Error

**UI / UX.** Two-pane translator workflow. Not pixel-clone of any vendor. Preserve: two-pane flow, immediate translation, minimal-friction copy, visible provider selector, visible source/target language controls, quick-translate popup, local history access, clear disabled states. Avoid: multi-step form flows, provider-specific UI branches in main path, low-value controls, hidden critical state.

**State.** Business logic out of presentation components. Normalize provider responses before UI consumption. Persist only required. Separate sensitive config from standard UI settings. Latest translation request wins state; cancel stale in-flight requests.

**History.** Local only. Successful text translation creates entry: source, translation, source lang, target lang, provider, timestamp. Clear, disable, reopen-into-editor supported. No cloud sync.

**Document translation.** UI reflects real provider capability. Unsupported = disabled, not faked. File I/O in main. No transform provider-returned files unless spec requires. Preserve original content boundaries.

**Language.** No hardcode supported languages. Fetch via adapter. Normalize to shared structures. Reset selection safely if invalid after provider switch.

**Error handling.** Normalize all failures into explicit shared categories: network unavailable, endpoint unreachable, TLS/cert, auth, unsupported language, unsupported document type, quota exceeded, rate limited, invalid provider response, internal app error. Never throw raw provider errors into UI. UI receives normalized, typed, user-displayable errors only.

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

TypeScript strict. Avoid `any` unless documented. Small modules, explicit responsibility. No duplicated provider logic. Components render and interact — that's it. Side effects centralized in services / composables. Typed zod schemas for settings + provider configs. Composition over inheritance. Predictable data flow over hidden convenience.

Hard rules from past feedback:

- No silent catch blocks — every `catch (err: unknown)` surfaces via `useHandleError` / `useToast`.
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

Keep directory structure coherent. Update docs when behavior changes. Update tests with code changes. Avoid unrelated refactors in feature work. Keep commits scoped. **Update `docs/state.md` after each phase/iteration** when status, branch, tests, decisions, deferred items change.

Architectural deviation → document why current architecture insufficient, what boundary changes required, what new risks introduced.

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
