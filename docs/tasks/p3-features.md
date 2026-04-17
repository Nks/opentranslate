# P3 — Features (new capabilities)

New functionality. Implement after core UX is solid.

---

### B-012: Google Cloud Translation — API key option
**Category:** Settings
**Effort:** Medium
**Files:** `electron/providers/google/descriptor.ts`, `electron/providers/google/http-client.ts`

Add API key input for Basic edition (alternative to service account JSON).
For Advanced edition, allow pasting JSON content into a textarea and
store via `safeStorage`.

---

### B-013: Shortcuts settings — editable + working
**Category:** Settings
**Effort:** Large
**Files:** `app/pages/settings.vue`, `electron/services/shortcuts/`, `electron/main/index.ts`

- UI to edit/record keyboard shortcuts (listen for key combo)
- Fix global shortcut registration (macOS Accessibility permissions)
- Global listening when app is in background
- Permission request dialog on macOS
- Superseded in part by B-033 and B-034

---

### B-014: Save button instead of auto-save
**Category:** Settings
**Effort:** Medium
**Files:** `app/pages/settings.vue`

Replace auto-save-on-change with explicit "Save" button + toast
notification confirming success/failure.

---

### B-017: System tray / menu bar service
**Category:** Application Lifecycle
**Effort:** Medium
**Files:** `electron/main/index.ts` (new tray module)

System tray (Windows/Linux) or menu bar (macOS). Menu: Open, Quick
Translate, Settings, Quit.

---

### B-018: Launch at startup setting
**Category:** Application Lifecycle
**Effort:** Small
**Files:** `electron/main/index.ts`

"Launch at startup" toggle via `app.setLoginItemSettings()`.

---

### B-019: Close behavior options
**Category:** Application Lifecycle
**Effort:** Medium
**Files:** `electron/main/index.ts`, `shared/types/settings.ts`

Setting: Keep in background (default) / Quit / Ask each time (with
"Remember my choice" checkbox).

---

### B-021: Native menu bar integration
**Category:** Application Lifecycle
**Effort:** Medium
**Files:** `electron/main/index.ts`

macOS: "Preferences..." (⌘+,). Windows/Linux: "Settings" in Edit/Help
menu. Use `Menu.setApplicationMenu` for File, Edit, View, Window, Help.

---

### B-022: Source and target language selectors on Documents page
**Category:** Documents
**Effort:** Small
**Files:** `app/pages/documents.vue`

Add language selectors matching the translate page. Pick source (or Auto
Detect) and target before uploading.

---

### B-023: Custom theme picker with color configuration
**Category:** Settings
**Effort:** Medium
**Files:** `app/pages/settings.vue`, `app/app.config.ts`

Color picker for primary/neutral colors + border radius. Use Nuxt UI
`ColorPicker`. Persist via settings store. Update theme tokens at runtime.
