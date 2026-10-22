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

---

### B-036: Microsoft Translator (Azure) provider — F0 free tier
**Category:** Providers
**Effort:** Medium
**Files:** `electron/providers/microsoft/` (new), `shared/providers/contract.ts`,
`app/pages/settings.vue`, `electron/ipc/channels.ts`

Add Azure AI Translator as the third provider, using the **F0 free
tier** with a user-supplied subscription key + region.

**Scope (F0):**
- Text translation: `POST /translate?api-version=3.0`
- Source detection: `POST /detect?api-version=3.0`
- Language list: `GET /languages?api-version=3.0` (also used as
  health probe — no dedicated health endpoint exists)
- Document translation: capability reports `false` on F0 (requires
  S1 + custom-domain resource + Azure Blob Storage; out of scope for
  this task)

**Auth:** subscription key + region via request headers
`Ocp-Apim-Subscription-Key` and `Ocp-Apim-Subscription-Region`.
Secrets stored via the existing `safeStorage` vault.

**Endpoint:** `https://api.cognitive.microsofttranslator.com`
(regional variants allowed).

**Implementation:** thin HTTP adapter in `electron/providers/microsoft/`
using Node `fetch`. Do not import `@azure-rest/ai-translation-text`
— the SDK wraps the same REST surface and pulls in Azure Core +
Identity which we do not need for API-key auth. Normalize errors to
shared categories (401/403 → auth, 429 → rate-limited or quota,
400 → unsupported language, 408/5xx → network/internal).

**Settings UI:**
- Key + region inputs
- Deep-link button to
  `https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation`
- Inline note: "Requires a credit card at Azure signup (free tier
  F0). Document translation is unavailable on the free tier."

**Caveats (document in provider docs + settings):**
- F0 quota is 2M characters **per hour**, not per month
- 12-month free-tier expiry on new Azure accounts
- Non-trivial onboarding (credit card required for identity check)
- No quota-query endpoint — surface 429 reactively

**Out of scope:** document translation, Custom Translator models,
transliteration, breaksentence endpoint.
