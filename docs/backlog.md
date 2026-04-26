# Backlog — Post-Phase 12 Tasks

_Created: 2026-04-16. Items to be addressed after current phase work is
merged._

---

## Provider Selection & State

### B-001: Auto-select first available provider on startup
The "Select provider" dropdown should pick the first configured/active
provider automatically when the app launches, instead of showing an empty
state.

### B-002: Provider status indicators in dropdown
The provider selector must show each provider's status:
- **Active providers** (configured + reachable) listed first, normal style
- **Inactive providers** (unconfigured or unreachable) listed at the bottom,
  greyed out with a clear "not configured" designation
- User cannot select a disabled/inactive provider

### B-003: Empty-state screen when no providers configured
If none of the providers are active, display a centered message:
"Configure a provider in Settings to start translating" with a button
linking to the Settings → Providers tab.

### B-004: Persist last-selected provider and languages
The app must remember the user's last-selected provider, source language,
and target language across sessions. Restore on next launch.

---

## Language Selection

### B-005: Fix swap languages toggle button
The swap (⇄) button on the index page does not work. Implement:
- Swap source and target languages
- Move translated text to source input
- Re-trigger translation
- Disable when source is Auto Detect (already done visually)

### B-006: Output language must never be Auto Detect
The target language selector should always default to the first available
language from the provider, never show "Auto Detect" option.

### B-007: Disable language selectors when provider has no languages
If the active provider returns an empty language list, both source and
target language selectors should be disabled with a tooltip explaining why.

### B-008: Disable textareas when no provider is active
If no provider is selected/active, both input and output textareas should
be disabled (read-only + dimmed) with placeholder text explaining the
user needs to select a provider first.

### B-009: Show detected language in Auto Detect label
When source is "Auto Detect" and a detection result comes back, display
"Auto Detect (English)" in the source selector. Allow the user to click
to toggle/lock the detected language as explicit source.

---

## Documents

### B-022: Source and target language selectors on Documents page
The Documents page must have source language and target language
selectors (same as the main translate page). User should be able to
pick source language (or Auto Detect) and target language before
uploading a document for translation.

---

## History

### B-010: History is not recording translations
The translation orchestrator does not call `history:add` after a
successful translation. Wire the orchestrator to automatically add a
history entry after each successful `translation:translate` response.

---

## Settings

### B-023: Custom theme picker with color configuration
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
Refactor the Providers section in Settings to use a horizontal tab bar
(one tab per provider) instead of a single scrollable list.

### B-012: Google Cloud Translation — API key option
Instead of requiring a service account JSON file, add an API key input
option for Basic edition. For Advanced edition where service account is
necessary, add the ability to paste JSON content directly into a text
area and store it securely via `safeStorage`.

### B-013: Shortcuts settings — editable + working
- Add UI to edit/record keyboard shortcuts (listen for key combo)
- Fix global shortcut registration (macOS needs Accessibility permissions)
- Shortcuts should listen globally when app is in background
- Show permission request dialog on macOS if needed

### B-014: Save button instead of auto-save
All settings must be saved only when the user clicks an explicit "Save"
button. Show a toast notification (via Nuxt UI `useToast`) confirming
the save succeeded or failed. Remove the current auto-save-on-change
behavior.

### B-015: Reset local data confirmation
The "Reset Local Data" button must show a confirmation dialog before
executing. Use Nuxt UI `Modal` or `AlertDialog` for the confirmation.

### B-016: Default shortcut based on OS
- macOS: `⌘+C+C` (show ⌘ icon, not "Command")
- Windows: `Ctrl+C+C`
- Linux: `Ctrl+C+C`

Detect OS at runtime via `process.platform` and set the default
accordingly in `defaultAppSettings`.

---

## Technical Debt

### B-029: Audit IPC serialization overhead — remove if redundant
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

---

## Error Handling

### B-031: No silent catch blocks — toast all frontend errors
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

### B-025: Rich text support in textareas
Replace plain `UTextarea` with a basic visual editor that preserves
formatting (bold, italic, lists, links) when pasting from rich-text
sources. Use Nuxt UI's `Editor` component or TipTap integration.
Include a "Clear Formatting" button (icon: `i-fluent-text-clear-formatting-24-regular`)
that strips all formatting back to plain text. The provider API
receives plain text; formatting is purely for display/copy fidelity.

### B-026: Copy button shows "Copied" feedback
When the user clicks the "Copy" button on the output pane, the button
text should change to "Copied" (with a check icon
`i-fluent-checkmark-24-regular`) for ~2 seconds, then revert to "Copy".
Use VueUse's `useClipboard` `copied` ref for the timeout state.

---

## UI / Layout

### B-024: Custom header with two-pane translator tab navigation
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
The app must sit in the background and display an icon in the system
tray (Windows/Linux) or menu bar (macOS). Clicking the icon shows a
menu with: Open, Quick Translate, Settings, Quit.

### B-018: Launch at startup setting
Implement the "Launch at startup" toggle in General settings. Use
Electron's `app.setLoginItemSettings()` API.

### B-019: Close behavior options
Add setting for close button behavior:
- **Keep in background** (minimize to tray, default)
- **Quit the app**
- **Ask each time** (show dialog with "Remember my choice" checkbox)

### B-020: Settings in a separate window
Settings should open in a dedicated `BrowserWindow`, not as a page in
the main window. Preferences live in a separate modal window.

### B-021: Native menu bar integration
Add "Preferences…" (⌘+,) to the macOS application menu, "Settings" to
the Windows/Linux Edit or Help menu. Use Electron's `Menu.setApplicationMenu`
to build a proper native menu bar with: File, Edit, View, Window, Help.

---

## Packaging & Distribution

### B-032: Apple code signing and notarization
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
