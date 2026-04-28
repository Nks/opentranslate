# Backlog — Post-Phase 12 Tasks

_Created: 2026-04-16. Last priority audit: 2026-04-28._

---

## Priority Legend

- **P0** — Broken core flow, blocks usable build. Fix next.
- **P1** — Important UX gap or pre-distribution requirement.
- **P2** — Visible polish or follow-up needed before public release.
- **P3** — Nice-to-have / long-term improvement / techdebt.
- **DEFERRED** — Investigated, intentionally not pursued.

## Top of queue

| Priority | IDs |
|---|---|
| **P0** | B-010 |
| **P1** | B-017, B-040, B-043, B-047, B-049 |
| **P2** | B-002, B-009, B-011, B-012, B-013, B-018, B-019, B-021, B-022, B-032, B-039, B-041, B-044 |
| **P3** | B-005, B-014, B-020, B-023, B-024, B-025, B-029, B-030, B-031, B-036, B-045, B-046, B-048, B-050 |
| **DEFERRED** | B-035 |

Recommended next bundles:
1. **P0 fix:** B-010 (history not writing — diagnose main-process handler / SQLite store / `historyEnabled` gate).
2. **P1 hygiene:** B-046 + B-043 (.gitkeep cleanup + production DevTools lockdown).
3. **P1 provider config:** B-040 + B-012 (Google file picker + API-key alternative).
4. **P1 platform:** B-017 (system tray; unblocks B-013 background listening, B-019 ask-to-quit, B-018 launch-at-startup).

---

## Provider Selection & State

### B-002: Provider status indicators in dropdown
**Priority:** P2

The provider selector must show each provider's status:
- **Active providers** (configured + reachable) listed first, normal style
- **Inactive providers** (unconfigured or unreachable) listed at the bottom,
  greyed out with a clear "not configured" designation
- User cannot select a disabled/inactive provider

## Language Selection

### B-005: Fix swap languages toggle button
**Priority:** P3 — implementation appears in `app/pages/index.vue:swapLanguages`; smoke-test before closing.

The swap (⇄) button on the index page does not work. Implement:
- Swap source and target languages
- Move translated text to source input
- Re-trigger translation
- Disable when source is Auto Detect (already done visually)

### B-009: Show detected language in Auto Detect label
**Priority:** P2

When source is "Auto Detect" and a detection result comes back, display
"Auto Detect (English)" in the source selector. Allow the user to click
to toggle/lock the detected language as explicit source.

### B-049: Prevent identical source + target language selection
**Priority:** P1 — in flight on `fix/b-049-language-pair`.

The two language dropdowns must never settle on the same code.
Required behaviour:
- When the user picks a language in either dropdown that matches the
  *other* dropdown's current value, the picker silently swaps the
  pair. Example: source=English, target=Russian; user picks English
  in target → app sets source=Russian, target=English (and re-runs
  the translation).
- The dropdown items themselves should hide / disable the option
  that already lives in the opposite dropdown so the swap is the
  exception path, not the routine one.
- Auto-detect on the source side bypasses the rule (target can be
  any explicit language while source is auto).
- Cover the rule in a new `useSelectionReconcile` helper or extend
  the existing one so both `onSourceLanguageChange` and
  `onTargetLanguageChange` go through the same swap logic. Persist
  the resulting pair via `persistSelection` like any other change.
- Tests: update `useSelectionReconcile.test.ts` (or add one) for
  source-equals-target swap, target-equals-source swap, and the
  auto-detect bypass.

---

## Documents

### B-022: Source and target language selectors on Documents page
**Priority:** P2

The Documents page must have source language and target language
selectors (same as the main translate page). User should be able to
pick source language (or Auto Detect) and target language before
uploading a document for translation.

---

## History

### B-010: History is not recording translations
**Priority:** P0 — user-confirmed broken on 2026-04-28. Renderer-side `recordHistoryEntry` exists in `useTranslation.ts`; bug now lives downstream (main-process `history:add` handler / SQLite store / `historyEnabled` gate).

The translation orchestrator does not call `history:add` after a
successful translation. Wire the orchestrator to automatically add a
history entry after each successful `translation:translate` response.

---

## Settings

### B-023: Custom theme picker with color configuration
**Priority:** P3

Add a theme customization panel in Settings (Appearance/General tab)
where the user can configure primary and neutral colors using a color
picker. Use Nuxt UI's `ColorPicker` component and follow the pattern
from the Nuxt UI docs theme picker:
https://github.com/nuxt/ui/tree/v4/docs/app/components/theme-picker

The selected colors should update the app's `app.config.ts` theme
tokens at runtime and persist across sessions via settings store.
Users should be able to pick primary color, neutral color, and
border radius preference.

### B-011: Separate providers by tabs in Settings
**Priority:** P2

Refactor the Providers section in Settings to use a horizontal tab bar
(one tab per provider) instead of a single scrollable list.

### B-012: Google Cloud Translation — API key option
**Priority:** P2 — pair with B-040 (file picker + validation) when picked.

Instead of requiring a service account JSON file, add an API key input
option for Basic edition. For Advanced edition where service account is
necessary, add the ability to paste JSON content directly into a text
area and store it securely via `safeStorage`.

### B-013: Shortcuts settings — editable + working
**Priority:** P2 — partially closed by PR #24 (recorder UI, registrar, permission prompt). Background-listening leg blocked on **B-017** (tray) — the renderer must stay alive when the main window is closed for global shortcuts to fire reliably.

- Add UI to edit/record keyboard shortcuts (listen for key combo) — ✅ done
- Fix global shortcut registration (macOS needs Accessibility permissions) — ✅ done
- Shortcuts should listen globally when app is in background — ⏳ depends on B-017
- Show permission request dialog on macOS if needed — ✅ done

### B-014: Save button instead of auto-save
**Priority:** P3 — current auto-save behaviour works; revisit if user testing shows confusion.

All settings must be saved only when the user clicks an explicit "Save"
button. Show a toast notification (via Nuxt UI `useToast`) confirming
the save succeeded or failed. Remove the current auto-save-on-change
behavior.

### B-039: Shortcut recorder must capture multi-key chords (C+V, C+X, …)
**Priority:** P2

The current `ShortcutRecorder` finalises after the first non-modifier
key and synthesises a self-chord (`Cmd+C+C`). Users who try to record
`Cmd+C+V` or `Cmd+C+X` end up with `Cmd+C+C`. Update the recorder so
holding the modifier and pressing two distinct trailing keys produces
the chord the user actually pressed, while preserving the existing
`X+X` self-chord ergonomics. Update
`shared/shortcuts/quick-translate.ts` parser/validator and the
ShortcutRecorder component to surface a "press second key" state
between the two trailing keys.

### B-040: Google Cloud Translation — file picker + validation + connection test
**Priority:** P1

Replace the bare "service account JSON path" text input with a file
picker (`dialog.showOpenDialog` in main, IPC channel for renderer).
After selection:
1. Read the file and validate it parses as a Google service-account
   JSON (must contain `client_email`, `private_key`, `project_id`).
2. Run a live `provider:switch` test against Google with the parsed
   credential and surface the result inline (success / specific
   error category, never the raw stack).
3. Persist the credential through `safeStorage` (do not store the
   path; store the contents). The renderer never sees the JSON.
Reject silently-broken paths and pre-empty placeholders so the user
cannot save settings that will only fail at translate time.

---

## Technical Debt

### B-029: Audit IPC serialization overhead — remove if redundant
**Priority:** P3

The `safeHandler()`, `serialize()` (JSON round-trip), and `stripReactive()`
layers were added to fix "An object could not be cloned" errors. The
actual root cause was Vue reactive proxies crossing the context bridge,
now fixed by `wrapApi()` in `app/composables/useApi.ts`.

Investigate whether the main-process-side serialization is still needed:
- `electron/services/ipc/safe-handler.ts` — `serialize()` JSON round-trips
  every return value. May be redundant since main process never returns
  Vue reactive objects.
- `safeHandler()` error wrapping — still valuable for converting `AppError`
  (non-clonable `cause`) to plain `Error`. Keep this.
- `stripReactive()` in preload — may be redundant since `wrapApi()` already
  serializes at the renderer level before context bridge.

Test: remove `serialize()` from `safeHandler`, keep error wrapping only.
If no "object could not be cloned" errors recur, the cleanup is safe.
Remove `stripReactive()` from preload if `wrapApi()` covers all paths.

### B-046: Repository cleanup — delete obsolete `.gitkeep` files
**Priority:** P3 — pair with B-043 in a "repo hygiene" bundle.

Every tracked directory now contains real source files, so the
`.gitkeep` placeholders are dead weight. Run a sweep:

```bash
find . -name '.gitkeep' \
  -not -path './node_modules/*' \
  -not -path './.git/*' \
  -not -path './.claude/worktrees/*' \
  -delete
```

Concrete files to remove (current tree): `app/.gitkeep`,
`electron/.gitkeep`, `scripts/.gitkeep`, `tests/.gitkeep`,
`tests/unit/.gitkeep`, `tests/integration/.gitkeep`,
`tests/e2e/.gitkeep`. Worktree copies under `.claude/worktrees/**`
and `node_modules/**` are out of scope (worktrees are disposable;
node_modules is vendored). Verify each parent still tracks at least
one real file before deleting.

### B-048: Code deduplication audit — extract reusable helpers
**Priority:** P3

Sweep the entire codebase for duplicated logic and lift the
repeats into shared utilities. Focus areas observed during the P1
work and worth re-checking after merges land:

- **Renderer error formatting:**
  `err instanceof Error ? err.message : String(err)` repeats in
  every catch in `app/`. Extract `toErrorMessage(err: unknown):
  string` (or fold it into the existing
  `app/composables/useHandleError.ts`).
- **Settings tab boilerplate:** `SettingsGeneralTab`,
  `SettingsAdvancedTab`, `SettingsShortcutsTab` repeat the
  `update:field` emit + `withDefaults` pattern. Extract a small
  composable or base component so each tab declares only fields.
- **`ProviderSettingsForm` field-by-type rendering:** the
  `boolean | number | enum | string` branches are open-coded twice
  (general + advanced groups). Extract one
  `<ProviderSettingField :field :value @update />` child component
  and let the form iterate.
- **IPC `safeHandler` lambdas in `electron/main/ipc-setup.ts`:**
  the `safeHandler(async (_event, input) => handlers[…](input as
  …))` shape repeats per channel. Extract a small typed helper
  that takes a channel name + handler and returns the bound
  function.
- **Provider HTTP error mapping:** Google and LibreTranslate adapters
  each ship their own status-code → `AppError.category` switch.
  Lift the shared categories into
  `shared/providers/http-mapper.ts` (already exists for some
  cases — extend it).
- **Test stubs:** `stubs: { UButton: ..., UIcon: true, ... }` is
  copied into ~10 test files. Add a `tests/_helpers/ui-stubs.ts`
  exporting a `nuxtUiStubs(extra?)` factory.

Workflow: run `jscpd` (or `npx jscpd app electron shared`) to
generate a duplication report, prioritise hotspots over 50 tokens
of repetition, and split each extraction into its own commit so
review stays small. Add a regression `pnpm dedupe-check` script
that fails CI when duplication exceeds an agreed threshold.

---

## Security

### B-047: Security audit — automated scan + agent review
**Priority:** P1 — automated half landed in PR #27 (CodeQL, Trivy, Semgrep, gitleaks, license-checker, Dependabot). Manual agent review + threat-model doc still pending.

Stand up a recurring security review so we catch regressions in
the renderer/main boundary. Required steps:

1. **Automated scan baseline.** Add `pnpm audit --prod`,
   `npm exec @electron/depcheck`, and an Electron-specific check
   (e.g. `electron-builder verify` plus `electronegativity`) to a
   GitHub Action that runs on every PR and on a weekly cron.
   Fail the build on `high`/`critical` findings.
2. **Manual agent review.** Run the `security-auditor` /
   `security-architect-aidefence` agents over the codebase with
   focus on:
   - `contextIsolation: true`, `nodeIntegration: false`,
     `sandbox: true`, no remote module — all enforced.
   - Preload surface (`electron/preload/index.ts`) exposes only
     the channels in `electron/ipc/channels.ts`; no eval/Function.
   - Provider HTTP clients: TLS verification on by default,
     `allowSelfSignedTls` strictly opt-in, never logged.
   - Secrets: `safeStorage` round-trip, no plaintext on disk,
     never crossed back to renderer (no `secrets:get`).
   - Clipboard reads only on explicit quick-translate; no idle
     polling.
   - CSP for the renderer (`Content-Security-Policy` meta or
     header) — restrict `connect-src` to provider endpoints and
     `'self'`.
   - macOS Accessibility / quick-translate path: confirm we never
     fall back to private APIs and prompt cleanly when permission
     is missing.
3. **Threat-model doc.** Capture the result in
   `docs/security-review.md` with a date, scope, findings table,
   and remediation tickets. Re-run quarterly or before each
   release tag.
4. **Dependency policy.** Document the rule against adding new
   dependencies that ship native code without
   `asarUnpack` + `onlyBuiltDependencies` review (see existing
   memory note on native module externals).

---

## Error Handling

### B-031: No silent catch blocks — toast all frontend errors
**Priority:** P3 — `useHandleError` exists; most call sites converted. One-time audit + ESLint rule still owed.

**Non-negotiable.** Every `try/catch` in `app/` that currently swallows
errors silently (empty catch or `// outside Electron` comments) must
display the error to the user via Nuxt UI's `useToast()`. This applies
even when the code runs outside Electron (e.g., SSR, browser preview).

Current violations (audit all `catch` blocks in `app/`):
- `app/composables/useTranslation.ts` — `cancelTranslation` catch
- `app/composables/useHistory.ts` — multiple catch blocks
- `app/composables/useApi.ts` — thrown error is OK (already visible)
- `app/pages/index.vue` — `loadProviders` catch
- `app/pages/settings.vue` — `loadSettings`, `onSecretChange`,
  `loadProviders`, `onProviderFieldChange` catch blocks
- `app/pages/documents.vue` — `checkDocumentSupport` catch
- `app/pages/overlay.vue` — `openInFull`, `closeOverlay` catch

Create `app/composables/useHandleError.ts`:
```ts
export function useHandleError() {
  const toast = useToast()

  return (err: unknown) => {
    toast.add({
      title: 'Error',
      description: err instanceof Error ? err.message : String(err),
      color: 'error',
    })
  }
}
```

Replace pattern:
```ts
// BEFORE (wrong)
catch {
  // outside Electron
}

// AFTER (correct)
catch (err) {
  handleError(err)
}
```

Where `const handleError = useHandleError()` is called once per
composable/setup. Never write the toast logic inline — always delegate
to the utility.

Add an ESLint rule (`no-empty` is already on; add `no-restricted-syntax`
to flag catch blocks with empty bodies or only comments) to prevent
future regressions.

---

## Internationalization

### B-030: Application i18n support
**Priority:** P3

Add multi-language support for the application UI itself using
`@nuxtjs/i18n`. All user-facing strings (labels, placeholders, error
messages, settings names, status text) should be extracted into locale
files. Ship with English as the default locale; add at least one
additional locale (e.g., Ukrainian, Spanish, or German) as proof of
the i18n pipeline. The selected UI language should be persisted in
`AppSettings` and selectable in Settings → General. Use Nuxt UI's
`LocaleSelect` component for the language picker.

---

## Translation UI

### B-050: Show translation alternatives when the provider returns them
**Priority:** P3

LibreTranslate's `POST /translate` response can include an
`alternatives: string[]` array (when `alternatives > 0` is requested).
Surface those next to the main translation so the user can pick a
better wording without retrying.

Required pieces:
- Provider contract: extend the shared translation result with an
  optional `alternatives?: string[]`. Default to empty / undefined
  when the provider does not supply any so existing adapters keep
  compiling.
- LibreTranslate adapter: pass `alternatives: 3` in the request body
  and forward `data.alternatives` from the response. Other adapters
  (Google) leave the field `undefined`.
- Renderer: if `alternatives.length > 0`, render them under the
  output pane as a compact list (Nuxt UI `UBadge` or `UButton size=xs`).
  Clicking an alternative replaces `translatedText` and triggers
  `useClipboard.copied` semantics for the Copy button.
- Tests: contract test that LibreTranslate adapter forwards the
  array; renderer test that an empty / missing array hides the
  alternatives row.

### B-025: Rich text support in textareas
**Priority:** P3

Replace plain `UTextarea` with a basic visual editor that preserves
formatting (bold, italic, lists, links) when pasting from rich-text
sources. Use Nuxt UI's `Editor` component or TipTap integration.
Include a "Clear Formatting" button (icon: `i-fluent-text-clear-formatting-24-regular`)
that strips all formatting back to plain text. The provider API
receives plain text; formatting is purely for display/copy fidelity.

---

## UI / Layout

### B-041: Settings sidebar — full-height, left-aligned layout
**Priority:** P2

The vertical tab list in `app/pages/settings.vue` currently sits in a
fixed 12rem column (`w-48`) inside a flex row. Goal: a full-height
left rail that visually anchors to the window edge and stretches to
the bottom of the viewport, with the tab content filling the
remainder. Drop the `max-w-2xl` clamp on the content column so wide
forms (Providers, Advanced) breathe. Mirror Nuxt UI's docs sidebar
(`USlideover` or a manual flex layout with `h-screen`).

### B-024: Custom header with two-pane translator tab navigation
**Priority:** P3

Remove the native window title bar (`frame: false` in BrowserWindow).
Implement a custom draggable header with this layout:

- **Left side:** App logo/name
- **Center:** Tab navigation — Translate | Documents | Theme Picker
  (use `UTabs` or `UNavigationMenu` with `variant="link"` and
  `highlight`)
- **Right side:** Settings cog icon (`i-fluent-settings-24-regular`)
  opens settings in a separate window (see B-020), color mode toggle,
  window controls (minimize/maximize/close — custom-drawn for
  frameless window)
- **Draggable area:** `-webkit-app-region: drag` on the header bar,
  `no-drag` on interactive elements
- History accessible from a sidebar or drawer, not a top-level tab
- macOS traffic lights should be integrated into the custom header
  via `titleBarStyle: 'hidden'` + `trafficLightPosition` option

---

## Application Lifecycle

### B-017: System tray / menu bar service
**Priority:** P1 — unblocks B-013 (background shortcuts), B-018 (launch-at-startup loop), B-019 (close-to-tray default).

The app must sit in the background and display an icon in the system
tray (Windows/Linux) or menu bar (macOS). Clicking the icon shows a
menu with: Open, Quick Translate, Settings, Quit.

### B-018: Launch at startup setting
**Priority:** P2 — pair with B-017.

Implement the "Launch at startup" toggle in General settings. Use
Electron's `app.setLoginItemSettings()` API.

### B-019: Close behavior options
**Priority:** P2 — depends on B-017 (no tray means "Run in background" is meaningless).

Add a setting in General with three radio options for what happens
when the user closes the window (⌘+Q / Ctrl+Q / clicking X):
- **Run in background** — hide the window, keep the main process and
  global shortcuts alive (default once B-017 lands).
- **Quit the app** — fully exit on close.
- **Ask each time** — open a confirmation dialog every time.

When **Ask each time** is selected, intercept `before-quit` (and the
window `close` event on Windows/Linux) and show a Nuxt UI modal:

- Title: **Do you really want to quit?**
- Body: *Running OpenTranslator in the background will allow you to
  use shortcuts and quickly translate from any app.*
- Buttons: **Run in background**, **Quit**, **Cancel**.

Behaviour:
- "Run in background" → hide the window, do not quit, do not change
  the persisted preference.
- "Quit" → call `app.exit()`.
- "Cancel" → dismiss the dialog, leave the window as it was.
- Add a "Remember my choice" checkbox; when ticked the picked option
  becomes the new persisted close-behaviour value (so the next close
  skips the dialog).
- The dialog must be modal to the main window and survive a global
  shortcut firing while it is open (do not double-trigger).

### B-020: Settings in a separate window
**Priority:** P3

Settings should open in a dedicated `BrowserWindow`, not as a page in
the main window. Preferences live in a separate modal window.

### B-021: Native menu bar integration
**Priority:** P2

Add "Preferences…" (⌘+,) to the macOS application menu, "Settings" to
the Windows/Linux Edit or Help menu. Use Electron's `Menu.setApplicationMenu`
to build a proper native menu bar with: File, Edit, View, Window, Help.

### B-044: Open Settings via File menu (and ⌘+, on macOS)
**Priority:** P2 — concrete subset of B-021; can ship together.

Concrete subset of B-021: ensure the native application menu always
exposes a "Settings…" item under File (or the standard
"Preferences…" slot on macOS), bound to ⌘+, / Ctrl+,. Selecting it
either focuses the existing settings window (after B-020 lands) or
navigates the main window to `/settings`. The main-window title bar
button stays as a discoverability aid; the menu entry is the
keyboard-driven path.

### B-045: Quick-translate block list — per-app suppression
**Priority:** P3 — depends on B-017 + reliable foreground detection.

Add a Settings section where the user picks installed applications
that must never trigger quick-translate. When the configured shortcut
fires while one of those apps is foreground, the chord is observed
but the clipboard read, IPC translate call, and overlay window are
all skipped — no translation, no overlay, no clipboard mutation.

Required pieces:
- **Picker (renderer):** a list with "Add app…" button. The button
  opens an OS-native picker via a new IPC channel
  (`apps:pick`) that returns `{ name, bundleId, iconPng?, path }`.
  - macOS: `dialog.showOpenDialog` rooted at `/Applications`,
    `properties: ['openFile']`, `filters: [{ name: 'Apps',
    extensions: ['app'] }]`. Read `Info.plist` for `CFBundleIdentifier`
    and `CFBundleName`.
  - Windows: pick `.exe` from `Program Files` / `Program Files (x86)`;
    use the executable path as the identity key, display name from
    `VersionInfo.ProductName` when available.
  - Linux: pick a `.desktop` file from `/usr/share/applications` or
    `~/.local/share/applications`; key on the `.desktop` path.
- **Storage:** persist the entries as
  `AppSettings.quickTranslate.blockList: BlockedApp[]` where
  `BlockedApp = { id: string; name: string; iconDataUrl?: string }`
  and `id` is the OS-specific identity key above.
- **Foreground detection (main):** at quick-translate dispatch time,
  read the active window's owner before invoking the orchestrator.
  - macOS: `NSWorkspace.frontmostApplication.bundleIdentifier`
    (Electron exposes this via the `active-win` package or a small
    Swift helper); avoid private APIs.
  - Windows: `GetForegroundWindow` → `GetWindowThreadProcessId` →
    process executable path.
  - Linux: best-effort via `xdotool getactivewindow getwindowname`
    or `wmctrl`; document the dependency. If detection fails,
    treat as **not blocked** (fail-open) and log once.
- **Suppression:** when the foreground identity matches a block-list
  entry, return immediately from the global-shortcut handler. Do
  NOT read the clipboard, do NOT call `translation:translate`,
  do NOT show the overlay. Emit a debug log only.
- **Privacy / security:** the block list never leaves the machine.
  Icons are cached in `userData` next to the settings file; never
  embedded in error reports or telemetry (we have none, but be
  explicit). Foreground detection runs entirely in main and is
  bounded to the moment of shortcut dispatch.
- **Tests:** unit-test the suppression decision (matcher), integration
  test the picker IPC contract, and add a manual smoke step for each
  OS adapter since native foreground APIs are platform-gated.

---

## Packaging & Distribution

### B-043: Production build hardening — hide dev console + dev-only settings
**Priority:** P1 — must land before any binary is shared externally.

Production packages must:
- Disable the developer DevTools (`win.webContents.on('devtools-opened',
  () => win.webContents.closeDevTools())` or omit the open call when
  `app.isPackaged`); keep the existing dev-mode auto-open.
- Strip dev-only Settings rows from the Advanced tab when
  `app.isPackaged === true`. Candidates (audit current Advanced tab):
  raw "Reset Local Data" without modal in dev, debounce override,
  any flag whose only audience is engineers.
- Block the Ctrl+Shift+I / ⌥⌘I shortcut in production via a
  `globalShortcut`/`before-input-event` filter.
- Verify in CI that the packaged app does not bundle `vue-devtools`
  or any source maps reachable from the renderer.

### B-032: Apple code signing and notarization
**Priority:** P2 — required before shipping a macOS DMG to non-developer users; needs paid Apple Developer enrolment.

Enable macOS code signing and notarization for production distribution.
Follow the step-by-step guide in `docs/apple-signing.md`:
- Enroll in Apple Developer Program ($99/year)
- Create Developer ID Application certificate
- Configure `electron-builder.yml`: restore `hardenedRuntime: true`,
  entitlements, and add `notarize.teamId`
- Set CI secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Verify with `codesign --verify` and `spctl --assess`

---

## Provider Expansion

### B-035: Reverso provider — investigated, will not pursue
**Priority:** DEFERRED

Reverso was evaluated as a third provider alongside Google Cloud
Translation and LibreTranslate. Conclusion: **not feasible**.
- No public self-serve API. The `api-for-developers` page is an
  enterprise sales contact form, not an SDK. No documented pricing,
  no API key program, no free tier.
- The only reachable endpoint is the unofficial
  `api.reverso.net/translate/v1/translation`, gated by Cloudflare
  with Origin/Referer checks. Automated access violates Reverso's
  Terms of Service and risks cease-and-desist.
- The unofficial endpoint breaks whenever Reverso tightens its WAF;
  community wrappers have multi-month outage histories.
- Capability gaps vs. the shared provider contract: no language-list
  endpoint (would have to be hardcoded), no document translation,
  no structured error taxonomy, no health check. Meeting the
  contract would require faking capabilities, which conflicts with
  the "Do not fake provider capabilities" rule in `AGENTS.md`.
- No maintained Node library worth adopting. `reverso-api`
  (s0ftik3, MIT) wraps the same ToS-violating endpoint and has low
  adoption (~150 weekly npm downloads).

**If a third provider is wanted later, evaluate instead:**
- **Microsoft Translator (Azure)** — official, F0 free tier,
  documented auth and endpoints. See B-036.

Revisit Reverso only if it publishes a public developer program
with clear ToS for open-source clients.

**UX inspiration note:** Reverso's consumer desktop app uses
`Ctrl+Alt+Space` as a global shortcut and surfaces bilingual example
sentences from the `context.reverso.net` corpus. Worth referencing
when iterating on the quick-translate overlay, independent of any
Reverso API integration.

### B-036: Microsoft Translator (Azure) provider — add as third option
**Priority:** P3

Azure AI Translator was evaluated as a third provider. Conclusion:
**feasible with caveats** — add using the **F0 free tier** with a
user-supplied subscription key + region.

**Free tier (F0) summary:**
- 2 million characters **per hour** quota (not per month). Over-quota
  returns HTTP 429.
- Free for 12 months on new Azure accounts, then requires upgrade to
  S1 (pay-per-character) or a new account.
- **Credit card required at Azure signup** for identity verification
  ($1 auth, refunded). Non-trivial onboarding friction compared to
  LibreTranslate.
- Document translation is **not available on F0** — requires S1 with
  a custom-domain resource and Azure Blob Storage. Capability must
  report `documentTranslation: false` for any F0 key.

**Endpoints (`api.cognitive.microsofttranslator.com`, API version `3.0`):**
- `POST /translate?api-version=3.0&to=<lang>` — text translation
- `POST /detect?api-version=3.0` — source language detection (also
  auto-detected inside `/translate`)
- `GET /languages?api-version=3.0` — supported languages (also serves
  as a lightweight health probe; no dedicated health endpoint exists)
- Document translation endpoints exist but are gated to S1+.

**Auth:** subscription key + region via request headers
`Ocp-Apim-Subscription-Key` and `Ocp-Apim-Subscription-Region`. Keys
are rotatable in the Azure portal and scoped per-resource. Store via
`safeStorage` in the existing secrets vault.

**Implementation approach:**
- Build a thin HTTP adapter (~200 LOC) in `electron/providers/microsoft/`
  using Node `fetch`. Do **not** pull in `@azure-rest/ai-translation-text`
  — the SDK is a thin wrapper over the same REST endpoints and drags
  in the Azure Core pipeline + Identity chain we don't need for
  API-key auth.
- Normalize errors to shared categories: 401/403 → auth,
  429 → rate-limited or quota, 400 → unsupported language / invalid,
  408/5xx → network / internal. Error body shape:
  `{ "error": { "code": <6-digit>, "message": "..." } }`.
- Use `GET /languages` for the provider health check and to populate
  the language selector. No quota-query API exists — track client-side
  or surface 429 reactively.
- Settings UI: key + region inputs, deep-link button to
  `https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation`,
  inline note that document translation is unavailable on F0, and a
  note about the credit-card signup requirement.

**Capability report on F0:**
- `textTranslation: true`
- `languageDetection: true`
- `supportedLanguagesDiscovery: true`
- `documentTranslation: false`

**Out of scope for the initial adapter:** document translation
(revisit separately if S1 support is ever added), Custom Translator
models, transliteration endpoint, breaksentence endpoint.
