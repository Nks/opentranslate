# OpenTranslate Desktop — Product Specification

## 1. Product Name

**OpenTranslate Desktop**

## 2. Product Definition

OpenTranslate Desktop is a cross-platform desktop translator that reproduces the DeepL Translate desktop workflow for the parts that can be implemented consistently on top of two selectable providers:

- Google Cloud Translation
- LibreTranslate

The application is defined as:

- **Desktop-only application**
- **Electron runtime**
- **Nuxt 4 + Nuxt UI frontend**
- **MIT-licensed repository**
- **Provider-based translation client**
- **No bundled translation server**

## 3. Product Goal

Deliver a fully open-source desktop translator with a DeepL-style user experience for:

- text translation
- quick translation from any app via shortcut
- translation history
- document translation when supported by the active provider
- simple provider switching between Google Cloud Translation and LibreTranslate

## 4. Scope

### 4.1 In Scope

The application includes:

1. Desktop application shell
2. Main translation window
3. Global shortcut translation overlay
4. Translation history
5. Provider settings and switching
6. Text translation
7. Source-language auto-detection
8. Supported-language discovery
9. Document translation with provider capability gating
10. Local persistence of settings and history
11. Packaging for macOS, Windows, and Linux
12. MIT-licensed source repository with complete setup and build instructions

### 4.2 Out of Scope

The application does not include:

1. Writing assistance
2. Grammar correction
3. Browser extensions
4. OCR or image translation
5. Voice translation
6. Speech synthesis
7. User accounts
8. Cloud sync
9. Team billing and admin features
10. Provider-side model hosting inside Electron
11. Bundled LibreTranslate server distribution
12. Provider-specific enterprise customization features in the common UI

## 5. Licensing Model

1. The desktop application repository is licensed under **MIT**.
2. The application is a client to external translation services.
3. The repository must not embed LibreTranslate server code.
4. The repository may include setup documentation for self-hosted LibreTranslate.
5. Third-party services and servers retain their original licenses.

## 6. Target Platforms

### 6.1 macOS

- Apple Silicon build
- Intel build
- signed app bundle
- DMG installer artifact

### 6.2 Windows

- x64 build
- NSIS installer
- portable ZIP artifact

### 6.3 Linux

- x64 build
- AppImage artifact
- deb artifact

## 7. Required Technology Stack

1. **Electron**
   - desktop runtime
   - global shortcuts
   - clipboard access
   - native menus
   - filesystem access
   - secure IPC

2. **Nuxt 4**
   - renderer application
   - route-based UI
   - application state

3. **Nuxt UI**
   - all UI primitives and controls

4. **TypeScript**
   - mandatory for Electron main process
   - mandatory for preload bridge
   - mandatory for renderer
   - mandatory for shared types

5. **electron-builder**
   - packaging and release artifacts

6. **Node.js LTS**
   - pinned version in repository config

## 8. Architecture

### 8.1 Application Layers

The application uses three layers.

#### Electron Main Process

Responsible for:

- window lifecycle
- provider HTTP requests
- filesystem operations
- secret handling
- document translation workflow
- global shortcut registration
- clipboard access
- diagnostics

#### Preload Layer

Responsible for:

- secure typed IPC bridge
- exposing only approved functions to renderer

#### Nuxt Renderer

Responsible for:

- all screens
- all controls
- translation UI state
- settings UI
- history UI

### 8.2 Security Rules

1. `contextIsolation` is enabled.
2. `nodeIntegration` is disabled in renderer.
3. All provider HTTP calls happen in Electron main process.
4. Provider credentials never become directly accessible to renderer code.
5. Renderer communicates only through typed preload APIs.

## 9. Product Modes

### 9.1 Main Window Mode

The full desktop application window for normal use.

### 9.2 Quick Translate Mode

A compact overlay window invoked by the global shortcut. It translates currently selected text copied from any application.

## 10. Functional Specification

## 10.1 Main Translation Window

The main window contains the following regions.

### Top Bar

- provider selector
- source language selector
- swap button
- target language selector
- history button
- settings button

### Input Pane

- multiline text area
- clear button
- character counter
- auto-detect source language by default
- paste support
- keyboard focus on launch

### Output Pane

- translated text area
- copy button
- replace input with output button
- last translated timestamp
- active provider badge

### Bottom Status Area

- loading indicator
- request status
- retry action
- error summary when failed

### Main Translation Behavior

1. Translation triggers automatically after text changes.
2. Translation debounce is configurable.
3. Default debounce is **350 ms**.
4. Empty input produces empty output.
5. Whitespace-only input does not trigger translation requests.
6. Source language defaults to **Auto Detect**.
7. Target language must always be explicitly selected.
8. Swap is disabled when source language is unresolved auto-detect.
9. When source language becomes concrete, swap:
   - moves translated text into source input
   - swaps source and target languages
   - immediately re-runs translation

## 10.2 Quick Translate Overlay

### Default Shortcuts

- macOS: `Command + C + C`
- Windows: `Ctrl + C + C`
- Linux: `Ctrl + C + C`

### Behavior

1. Single copy does nothing beyond normal OS copy behavior.
2. The app reads clipboard only after the shortcut gesture is triggered.
3. The overlay appears above the active application.
4. The overlay displays:
   - detected source language
   - target language
   - translated text
   - copy translation button
   - open in full app button
   - retry action
5. Overlay closes on `Esc`.
6. Overlay remembers the last used target language.
7. Overlay translation uses the currently active provider.

## 10.3 Translation History

A dedicated history panel is required.

### History Entry Structure

Each entry contains:

- source text
- translated text
- source language
- target language
- provider
- created timestamp

### History Rules

1. Every successful text translation creates one history entry.
2. History is stored locally only.
3. History is searchable.
4. User can reopen an entry into the main editor.
5. User can copy source text.
6. User can copy translated text.
7. User can delete a single entry.
8. User can clear all history.
9. User can disable history completely.

## 10.4 Document Translation

A dedicated **Documents** screen is required.

### Documents Screen UI

- drag-and-drop area
- file picker button
- source language selector
- target language selector
- provider capability indicator
- progress state
- download translated file action
- error details panel

### Document Translation Rules

1. Documents screen is always visible.
2. Document translation actions are enabled only when the active provider supports document translation.
3. The app must never claim support when provider capability is absent.
4. All file I/O is performed in the main process.
5. Output filename format:
   - `<original-name>.<target-lang>.translated<original-extension>`
6. Provider-returned translated file is saved without modification.

## 10.5 Language Management

The app must not hardcode provider language lists.

### Rules

1. On provider activation, the app fetches supported languages.
2. Each provider language is normalized into a shared internal structure.
3. Shared language structure contains:
   - `code`
   - `name`
   - `providerCode`
   - `supportsSource`
   - `supportsTarget`
4. Source and target language selectors use normalized data only.
5. If language loading fails, translation is blocked and setup error state is shown.

## 10.6 Provider Switching

1. Provider can be changed at any time from main window.
2. On provider switch:
   - current source language is revalidated
   - current target language is revalidated
   - unsupported selections are reset
   - translation is re-run if input exists
3. Provider-specific settings remain persisted independently.
4. Last active provider is restored on next launch.

## 11. Provider Specification

## 11.1 Common Provider Contract

Every provider adapter implements the same contract.

### Required Methods

- `getHealth()`
- `getSupportedLanguages()`
- `detectLanguage(text)`
- `translateText(input)`
- `supportsDocumentTranslation()`
- `translateDocument(input)` when supported
- `getCapabilities()`

### Shared Text Translation Input

- `text`
- `sourceLanguage | auto`
- `targetLanguage`
- `format = text`
- `timeoutMs`

### Shared Text Translation Output

- `translatedText`
- `detectedSourceLanguage`
- `provider`
- `rawMetadata`

## 11.2 Google Cloud Translation Adapter

### Required Configuration Fields

1. Provider enabled toggle
2. Google Cloud project ID
3. credentials JSON file path
4. credentials validation action
5. API edition selector:
   - `Basic`
   - `Advanced`
6. location field for Advanced edition
7. request timeout

### Required Behavior

1. Text translation works in both Basic and Advanced mode.
2. Language detection works.
3. Supported-language listing works.
4. Document translation is enabled only in Advanced mode with valid configuration.
5. Credentials file is read only in Electron main process.
6. Errors are categorized into:
   - invalid credentials
   - disabled API
   - quota or billing error
   - unsupported language pair
   - network failure
   - invalid response

## 11.3 LibreTranslate Adapter

### Required Configuration Fields

1. Provider enabled toggle
2. Base API endpoint
3. optional API key
4. health check action
5. request timeout
6. allow self-signed certificate toggle
7. local/self-hosted informational indicator

### Required Behavior

1. Text translation works.
2. Auto-detection works.
3. Supported-language listing works.
4. API key is optional.
5. Document translation is enabled only if capability check confirms support.
6. Endpoint validation confirms:
   - reachability
   - valid response shape
   - supported languages available

## 12. Local / Self-Hosted Setup Requirement

The repository must include `docs/self-hosting/libretranslate.md`.

### Required Sections

1. Connect to public LibreTranslate-compatible endpoint
2. Connect to private hosted LibreTranslate endpoint
3. Connect to local machine endpoint
4. Explain provider endpoint format
5. Explain API key handling
6. Explain that the desktop app does not bundle the server
7. Explain that LibreTranslate belongs to the Argos Translate ecosystem

## 13. UI Specification

## 13.1 Visual Design

The application uses a DeepL-style desktop layout.

### Required Characteristics

1. Two-column translation layout on desktop width.
2. Source and target language controls above text panes.
3. Minimal interface chrome.
4. Strong focus on input and output text areas.
5. Fast copy interaction.
6. Light and dark mode.
7. System theme by default.

## 13.2 Required Screens

1. **Translate**
2. **Documents**
3. **History**
4. **Settings**
5. **About**

## 13.3 Settings Structure

### General

- launch at startup
- theme
- default target language
- debounce time
- history enabled
- history retention mode
- analytics disabled by default

### Shortcuts

- quick translate shortcut
- open main window shortcut
- enable/disable quick translation

### Providers

- Google Cloud Translation settings
- LibreTranslate settings

### Advanced

- request timeout
- TLS/self-signed handling for LibreTranslate
- diagnostic logs viewer
- reset local data

## 14. Data Storage Specification

The app uses local file-based storage in the standard per-user application data directory.

### Stored Data

1. app settings
2. provider settings
3. translation history
4. non-sensitive UI state

### Sensitive Data Rules

1. Sensitive values are stored separately from UI settings.
2. macOS and Windows use OS credential storage where available.
3. Linux uses system keyring where available.
4. If secure key storage is unavailable, the app must warn the user before local secret storage.

## 15. Error Handling

All provider errors must be normalized into explicit categories.

### Error Categories

1. network unavailable
2. endpoint unreachable
3. TLS/certificate error
4. authentication failure
5. unsupported language
6. document type unsupported
7. quota exceeded
8. rate limited
9. invalid provider response
10. internal app error

### UI Rules

1. Errors must be human-readable.
2. Raw diagnostic details are collapsed by default.
3. Failed requests must not automatically erase the previous successful translation.
4. Retry action is available where safe.

## 16. Performance Specification

1. App launch to interactive UI target: under 2 seconds on modern desktop hardware.
2. Quick translate overlay open target: under 250 ms excluding network latency.
3. Translation requests are cancellable.
4. Only the latest in-flight translation result may update the UI.
5. Large pasted text must debounce rather than flood provider requests.

## 17. Privacy Specification

1. Telemetry is disabled by default.
2. Translation content is not logged by default.
3. Diagnostic logs must redact credentials.
4. History is local-only.
5. Clipboard is read only after explicit shortcut invocation.
6. Active provider must always be visible in the UI.

## 18. Accessibility Specification

1. Full keyboard navigation is required.
2. All actions must be usable without mouse.
3. Screen-reader labels are required for all controls.
4. Visible focus states are required.
5. User-scalable font size is required.
6. High-contrast compatible theme tokens are required.
7. Shortcut customization must be available through settings UI.

## 19. Repository Specification

The repository contains the following top-level structure.

- `/app`
- `/electron`
- `/shared`
- `/docs`
- `/scripts`

### Required Documentation Files

1. `README.md`
2. `docs/architecture.md`
3. `docs/providers/google.md`
4. `docs/providers/libretranslate.md`
5. `docs/self-hosting/libretranslate.md`
6. `docs/packaging.md`
7. `docs/security.md`
8. `LICENSE`

## 20. Build and Run Specification

The repository must support:

1. local development mode
2. production build
3. desktop packaging
4. linting
5. type-checking
6. unit tests
7. end-to-end tests

### Required Scripts

- `dev`
- `build`
- `package`
- `lint`
- `typecheck`
- `test`
- `test:e2e`

## 21. Testing Specification

## 21.1 Unit Tests

Required for:

1. provider adapters
2. language normalization
3. shortcut parsing
4. history storage
5. settings validation
6. error mapping

## 21.2 Integration Tests

Required for:

1. Google adapter with mocked responses
2. LibreTranslate adapter with mocked responses
3. provider switching
4. document translation workflow
5. credential validation flow

## 21.3 End-to-End Tests

Required for:

1. app launch
2. main translation flow
3. quick translate overlay
4. history creation and reuse
5. settings persistence
6. disabled provider states
7. document translation capability enable/disable logic

## 22. Release Criteria

A release is acceptable only if all of the following are true:

1. App builds on macOS.
2. App builds on Windows.
3. App builds on Linux.
4. Text translation works with Google Cloud Translation.
5. Text translation works with LibreTranslate.
6. Auto-detect works on both providers.
7. Supported-language discovery works on both providers.
8. Global shortcut translation works on all target platforms.
9. Settings persist across restarts.
10. History persists and can be cleared.
11. Document translation is enabled only when actually supported.
12. Provider credentials are not exposed to renderer.
13. Repository is MIT-licensed and complete.

## 23. Explicit Product Decisions

These decisions are fixed and remove ambiguity from the specification.

1. The product is a desktop client only.
2. The shared feature set is provider-neutral first.
3. The design target is DeepL-style desktop interaction.
4. Provider-specific enterprise features are excluded from the common UI.
5. Google document translation requires Advanced provider configuration.
6. LibreTranslate document translation requires runtime capability confirmation.
7. Translation history is local only.
8. All provider requests are executed in Electron main process.
9. The repository remains MIT.
10. LibreTranslate server remains external to the application.

## 24. Final Scope Statement

OpenTranslate Desktop is a MIT-licensed Electron desktop translator with a Nuxt 4 + Nuxt UI frontend. It reproduces the DeepL desktop translation workflow for:

- text translation
- global shortcut quick translation
- translation history
- document translation when the active provider supports it

The application supports exactly two providers:

- Google Cloud Translation
- LibreTranslate

LibreTranslate configuration includes custom endpoint support for public, private, and local/self-hosted instances.
