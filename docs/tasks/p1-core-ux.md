# P1 — Core UX (app feels incomplete without these)

Fix after P0. These make first-time use coherent and prevent invalid states.

---

### B-001: Auto-select first available provider on startup
**Category:** Provider Selection
**Effort:** Small
**Files:** `app/pages/index.vue`, `app/composables/useTranslation.ts`

The "Select provider" dropdown shows empty on launch. Auto-pick the first
configured/active provider.

---

### B-006: Output language must never be Auto Detect
**Category:** Language Selection
**Effort:** Small
**Files:** `app/pages/index.vue`, `app/components/LanguageSelector.vue`

Target language selector should default to first available language from
the provider, never show "Auto Detect" option.

---

### B-008: Disable textareas when no provider is active
**Category:** Language Selection
**Effort:** Small
**Files:** `app/pages/index.vue`, `app/components/TranslationInput.vue`, `app/components/TranslationOutput.vue`

Both textareas should be disabled (read-only + dimmed) with placeholder
text when no provider is selected/active.

---

### B-003: Empty-state screen when no providers configured
**Category:** Provider Selection
**Effort:** Small
**Files:** `app/pages/index.vue`

Display centered message: "Configure a provider in Settings to start
translating" with a button linking to Settings > Providers.

---

### B-016: Default shortcut based on OS
**Category:** Settings
**Effort:** Small
**Files:** `shared/types/settings.ts`, `electron/main/index.ts`

Show correct modifier per OS:
- macOS: `⌘+C+C`
- Windows/Linux: `Ctrl+C+C`

Detect via `process.platform`. Set in `defaultAppSettings`.

---

### B-034: User cannot change global shortcut
**Category:** Global Shortcuts
**Effort:** Medium
**Files:** `app/pages/settings.vue`, `electron/main/index.ts`

Shortcuts tab shows the string but provides no editing. Implement:
- Key combo recorder input
- Validate as Electron accelerator string
- Re-register via IPC
- Persist to `AppSettings.shortcuts.quickTranslate`
- Related: B-013
