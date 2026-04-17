# P2 — Polish (improves experience)

Nice-to-have improvements. Implement after P0 and P1 are resolved.

---

### B-002: Provider status indicators in dropdown
**Category:** Provider Selection
**Effort:** Medium
**Files:** `app/components/ProviderSelector.vue`, `app/stores/providers.ts`

Show each provider's status in dropdown:
- Active providers listed first, normal style
- Inactive providers greyed out with "not configured" label
- Cannot select inactive provider

---

### B-007: Disable language selectors when provider has no languages
**Category:** Language Selection
**Effort:** Small
**Files:** `app/components/LanguageSelector.vue`

Disable both selectors with tooltip when active provider returns empty
language list.

---

### B-009: Show detected language in Auto Detect label
**Category:** Language Selection
**Effort:** Small
**Files:** `app/components/LanguageSelector.vue`, `app/stores/providers.ts`

Display "Auto Detect (English)" when detection result arrives. Allow
click to lock the detected language as explicit source.

---

### B-026: Copy button shows "Copied" feedback
**Category:** Translation UI
**Effort:** Small
**Files:** `app/components/TranslationOutput.vue`

Button text changes to "Copied" with check icon for ~2 seconds. Use
VueUse `useClipboard` `copied` ref.

---

### B-011: Separate providers by tabs in Settings
**Category:** Settings
**Effort:** Small
**Files:** `app/pages/settings.vue`

Horizontal tab bar (one tab per provider) instead of scrollable list.

---

### B-028: Remove all DeepL references
**Category:** Branding
**Effort:** Small
**Files:** `docs/opentranslate-desktop-spec.md`, `docs/opentranslate-desktop-prd.md`, `docs/architecture.md`, `AGENTS.md`, `README.md`, code comments

Replace "DeepL-style" with "two-pane translator layout" or "desktop
translation workflow". Audit all files.

---

### ~~B-029: Audit IPC serialization overhead~~ **CLOSED**
**Status:** Resolved in Phase 10 session. `serialize()` removed from
`safeHandler`, `stripReactive()` removed from preload. Only error
wrapping remains. `wrapApi()` handles renderer-side serialization.
