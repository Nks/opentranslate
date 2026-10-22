# P4 — Major Rework (large effort, plan carefully)

Significant effort or architectural changes. Schedule deliberately.

---

### B-020: Settings in a separate window
**Category:** Application Lifecycle
**Effort:** Large
**Files:** `electron/main/index.ts`, `app/pages/settings.vue`, routing

Settings opens in a dedicated `BrowserWindow`, not as a page in the
main window. Requires second window management, shared IPC, and
navigation changes.

---

### B-024: Custom frameless header with tab navigation
**Category:** UI / Layout
**Effort:** Large
**Files:** `electron/main/window-factory.ts`, `app/layouts/`, `app/components/`

Remove native title bar (`frame: false`). Custom draggable header with:
- App logo/name (left)
- Tab navigation: Translate | Documents (center)
- Settings cog, color mode toggle, window controls (right)
- `-webkit-app-region: drag` / `no-drag`
- macOS traffic lights via `titleBarStyle: 'hidden'`
- History in sidebar/drawer, not top-level tab

---

### B-025: Rich text support in textareas
**Category:** Translation UI
**Effort:** Large
**Files:** `app/components/TranslationInput.vue`, `app/components/TranslationOutput.vue`

Replace `UTextarea` with TipTap editor for format-preserving paste. Add
"Clear Formatting" button. Provider API still receives plain text;
formatting is display/copy fidelity only.

---

### B-030: Application i18n support
**Category:** Internationalization
**Effort:** Large
**Files:** All `app/` files with user-facing strings

Add `@nuxtjs/i18n`. Extract all strings to locale files. Ship English +
one additional locale (Ukrainian, Spanish, or German). Persist UI
language in `AppSettings`. Use Nuxt UI `LocaleSelect`.

---

### B-032: Apple code signing and notarization
**Category:** Packaging & Distribution
**Effort:** Medium (blocked on Apple Developer account)
**Files:** `electron-builder.yml`

Follow `docs/apple-signing.md`. Requires $99/year Apple Developer
Program enrollment. Blocked until account is available.
