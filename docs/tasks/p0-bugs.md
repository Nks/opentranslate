# P0 — Bugs (broken functionality)

Fix first. These are features that exist but don't work.

---

### B-010: History is not recording translations
**Category:** History
**Effort:** Small
**Files:** `electron/services/translation/handlers.ts`, `app/composables/useTranslation.ts`

The translation orchestrator never calls `history:add` after a successful
translation. Wire the orchestrator to automatically add a history entry
after each successful `translation:translate` response.

---

### B-005: Fix swap languages toggle button
**Category:** Language Selection
**Effort:** Small
**Files:** `app/pages/index.vue`, `app/stores/providers.ts`

The swap button is visible but does nothing. Implement:
- Swap source and target languages
- Move translated text to source input
- Re-trigger translation
- Disable when source is Auto Detect (already done visually)

---

### B-033: Global shortcuts (Cmd+C+C / Ctrl+C+C) not working
**Category:** Global Shortcuts
**Effort:** Medium
**Files:** `electron/main/index.ts`, `electron/services/shortcuts/`

The quick-translate chord shortcut does not fire. Debug:
- Verify `globalShortcut.register` returns `true`
- macOS: Accessibility permissions may be required — detect and prompt
- Verify chord detector timing window (500ms)
- Ensure registered on `app.whenReady()`, not before
- Related: B-013

---

### B-031: No silent catch blocks — toast all frontend errors
**Category:** Error Handling
**Effort:** Medium
**Files:** All `app/` files with try/catch blocks

Every `try/catch` in `app/` that swallows errors silently must display
the error via `useToast()`. Create `app/composables/useHandleError.ts`
utility. Add ESLint `no-restricted-syntax` rule to prevent regression.

Violations: `useTranslation.ts`, `useHistory.ts`, `index.vue`,
`settings.vue`, `documents.vue`, `overlay.vue`.
