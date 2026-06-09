# P1 — Core UX (app feels incomplete without these)

Fix after P0. These make first-time use coherent and prevent invalid states.

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
