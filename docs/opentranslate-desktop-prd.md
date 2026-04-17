# OpenTranslate Desktop — PRD

## 1. Document Information

### Document Title

OpenTranslate Desktop — Product Requirements Document

### Document Type

PRD

### Product Type

Cross-platform desktop translator

### Target Stack

- Electron
- Nuxt 4
- Nuxt UI
- TypeScript

### License Requirement

- MIT

## 2. Product Summary

OpenTranslate Desktop is a cross-platform desktop application that reproduces the core DeepL-style desktop translation experience while allowing the user to select one of two translation backends:

- Google Cloud Translation
- LibreTranslate

The product is a desktop client only. It does not bundle a translation server. It provides a consistent user interface for text translation, quick translation from any app, local translation history, and document translation when supported by the active provider.

## 3. Problem Statement

Users want a desktop translation application with the usability of DeepL Translate, but with the ability to choose their backend:

- a proprietary cloud backend for quality and scale
- an open/self-hosted backend for control and local deployment

There is no fully open-source MIT-licensed desktop client in the defined stack that delivers this exact provider-switching DeepL-style workflow on macOS, Windows, and Linux.

## 4. Product Objective

Build a production-ready desktop translator that:

1. feels like DeepL Translate on desktop
2. is fully open-source on the client side under MIT
3. runs on macOS, Windows, and Linux
4. lets the user switch between Google Cloud Translation and LibreTranslate
5. supports self-hosted LibreTranslate endpoints
6. keeps credentials and provider communication out of the renderer layer

## 5. Success Criteria

The product is successful when:

1. users can translate text immediately after initial setup
2. users can trigger translation from any application using a global shortcut
3. users can switch providers without changing the rest of the workflow
4. users can configure LibreTranslate via custom endpoint and optional API key
5. the app runs as packaged desktop software on all supported operating systems
6. the codebase is maintainable, typed, testable, and MIT-licensed

## 6. Product Scope

### 6.1 Included in Release Scope

- desktop application shell
- main translation window
- quick translation overlay
- local history
- provider switching
- provider settings
- supported-language discovery
- source-language auto-detection
- document translation with capability gating
- packaging for macOS, Windows, Linux
- complete setup and build documentation

### 6.2 Excluded from Release Scope

- writing assistant
- grammar correction
- browser extension
- OCR/image translation
- voice translation
- speech output
- cloud account system
- sync across devices
- browser integration
- team admin/billing features
- provider-specific enterprise tooling in shared UI
- embedded translation server

## 7. Target Users

### 7.1 Primary Users

1. Users who want a DeepL-like desktop translator but do not want to depend only on DeepL.
2. Users who want to choose between cloud translation and self-hosted translation.
3. Users who want a local desktop workflow on macOS, Windows, or Linux.
4. Developers and technical users who want to run LibreTranslate locally or on a private endpoint.

### 7.2 Secondary Users

1. Teams that want to distribute a controlled desktop translator internally.
2. Open-source users who need a desktop translator with transparent code and MIT licensing.

## 8. User Jobs

Users need to:

1. translate text quickly
2. translate selected text from any app
3. select target language once and reuse it
4. switch between providers without learning a new interface
5. save and reuse previous translations locally
6. translate documents when the provider supports it
7. configure a custom LibreTranslate endpoint
8. configure Google Cloud Translation credentials

## 9. User Stories

### Core Translation

- As a user, I want to paste text and see the translation automatically.
- As a user, I want the source language to be auto-detected by default.
- As a user, I want to choose the target language and keep it remembered.
- As a user, I want to swap source and target languages and continue translating.

### Quick Translate

- As a user, I want to select text in any app and translate it with a shortcut.
- As a user, I want the translation popup to appear without opening the full app.
- As a user, I want to copy the translated text directly from the popup.

### Provider Selection

- As a user, I want to choose between Google Cloud Translation and LibreTranslate.
- As a user, I want LibreTranslate to support a custom API endpoint.
- As a user, I want LibreTranslate to support an optional API key.
- As a user, I want provider switching without losing the app workflow.

### History

- As a user, I want to view past translations.
- As a user, I want to reopen a previous translation into the editor.
- As a user, I want to clear history.
- As a user, I want to disable history completely.

### Documents

- As a user, I want to upload a document for translation when the active provider supports it.
- As a user, I want the app to clearly tell me when document translation is unavailable.

## 10. Product Requirements

## 10.1 Core Experience Requirements

1. The product must open into the main translation window.
2. The main translation window must provide a two-pane translation layout.
3. Translation must auto-run after text input changes.
4. Source language must default to auto-detect.
5. The product must always display the active provider.
6. The target language must persist between launches.
7. The translation workflow must remain consistent across providers.

## 10.2 Quick Translate Requirements

1. The product must support a global shortcut translation flow.
2. The default shortcut must be:
   - macOS: `Command + C + C`
   - Windows: `Ctrl + C + C`
   - Linux: `Ctrl + C + C`
3. Clipboard content must only be read after explicit shortcut invocation.
4. The popup must show translated text, source detection, target language, and copy action.
5. The popup must support opening the full app.
6. The double-tap shortcut must observe the user's copy keystrokes without intercepting them, so a single copy action continues to work normally in every application.
7. On macOS, the quick-translate shortcut requires the user to grant Accessibility permission. On first run the app must explain why the permission is needed and link the user to the correct system settings pane. Without this permission the quick-translate shortcut is unavailable while the rest of the app continues to work for in-window translation. Windows and Linux do not require a separate permission prompt.

## 10.3 Provider Requirements

### Google Cloud Translation

The product must support:

- project-level configuration
- credentials file configuration
- text translation
- language detection
- supported-language discovery
- document translation only when configured in supported mode

### LibreTranslate

The product must support:

- custom endpoint configuration
- optional API key
- health check
- text translation
- auto-detection
- supported-language discovery
- runtime capability detection for document translation

## 10.4 History Requirements

1. Successful text translations must be stored locally as history entries.
2. History entries must include source text, translated text, language pair, provider, and timestamp.
3. History must be searchable.
4. History must support clear-all.
5. History must support single-entry deletion.
6. History must be disableable.

## 10.5 Document Requirements

1. The product must provide a dedicated documents screen.
2. The screen must include drag-and-drop and file picker support.
3. Document translation must only be enabled when supported by the active provider.
4. Unsupported provider state must be explained in the UI.
5. Provider-returned translated files must be saved without modification.

## 11. Functional Requirements

## 11.1 Main Window

The main window must contain:

- provider selector
- source language selector
- target language selector
- swap action
- text input area
- translated text output area
- copy translation action
- clear input action
- history access
- settings access

## 11.2 Settings

The settings area must contain the following sections.

### General

- launch at startup
- theme
- default target language
- translation debounce
- history enabled/disabled
- history retention mode

### Shortcuts

- quick translate shortcut
- open main window shortcut
- enable/disable quick translate

### Providers

- Google settings
- LibreTranslate settings

### Advanced

- request timeout
- TLS/self-signed behavior for LibreTranslate
- diagnostic logs viewer
- local data reset

## 11.3 Error Handling

The app must normalize provider errors into explicit user-facing categories:

- network unavailable
- endpoint unreachable
- authentication failure
- TLS/certificate problem
- quota exceeded
- unsupported language pair
- unsupported document type
- invalid response
- internal application error

The app must not erase prior successful translation output automatically on failed requests.

## 11.4 Data Persistence

The app must store locally:

- app settings
- provider settings
- history entries
- non-sensitive UI state

Sensitive values must be stored using OS credential storage where available.

## 12. Non-Functional Requirements

## 12.1 Security

1. Renderer must not have direct provider credential access.
2. All provider communication must occur in Electron main process.
3. `contextIsolation` must be enabled.
4. `nodeIntegration` must be disabled in renderer.
5. Logs must redact credentials.

## 12.2 Performance

1. App launch target: under 2 seconds on modern hardware.
2. Quick translate popup open target: under 250 ms excluding network latency.
3. In-flight translation requests must be cancellable.
4. Only the latest request result may update UI state.

## 12.3 Privacy

1. No telemetry by default.
2. No translation content logging by default.
3. History must remain local only.
4. Active provider must always be visible.

## 12.4 Accessibility

1. Full keyboard navigation.
2. Screen-reader labels for all controls.
3. Visible focus states.
4. Adjustable font sizing.
5. Shortcut customization from UI.

## 13. UX Requirements

### Visual Requirements

1. Two-column translator layout.
2. Minimal chrome.
3. Fast copy interaction.
4. Clear provider visibility.
5. Light mode and dark mode.
6. System theme by default.

### Interaction Requirements

1. Paste must be fast and immediate.
2. Translation must feel continuous, not form-based.
3. Shortcut popup must be lightweight and interrupt minimally.
4. Provider switching must not force users into separate app flows.

## 14. Technical Requirements

## 14.1 Architecture Requirements

The application must use:

- Electron main process
- preload bridge
- Nuxt renderer
- shared TypeScript models
- typed provider adapter abstraction

## 14.2 Provider Adapter Contract

Each provider must implement:

- `getHealth()`
- `getSupportedLanguages()`
- `detectLanguage(text)`
- `translateText(input)`
- `supportsDocumentTranslation()`
- `translateDocument(input)` when available
- `getCapabilities()`

## 14.3 Packaging Requirements

The product must produce:

- macOS DMG
- Windows NSIS installer
- Windows ZIP
- Linux AppImage
- Linux deb

## 15. Repository Requirements

The repository must include:

- `README.md`
- `docs/architecture.md`
- `docs/providers/google.md`
- `docs/providers/libretranslate.md`
- `docs/self-hosting/libretranslate.md`
- `docs/packaging.md`
- `docs/security.md`
- `LICENSE`

The repository structure must contain:

- `/app`
- `/electron`
- `/shared`
- `/docs`
- `/scripts`

## 16. Analytics Requirement

Telemetry is out of scope for the initial release.

If telemetry is ever introduced later, it must be:

- opt-in
- documented
- disabled by default
- non-content-based

## 17. Release Requirements

A release is acceptable only if:

1. the app builds on macOS, Windows, and Linux
2. Google Cloud Translation text translation works
3. LibreTranslate text translation works
4. auto-detect works on both providers
5. supported-language discovery works on both providers
6. quick translate shortcut works on all target platforms
7. settings persist after restart
8. history persists and can be cleared
9. document translation is only enabled when actually supported
10. renderer has no direct provider credential exposure
11. repository is MIT-licensed and complete

## 18. QA Acceptance Checklist

### Core

- [ ] App launches successfully
- [ ] Main translation window renders correctly
- [ ] Provider selector works
- [ ] Source auto-detect works
- [ ] Target language selection works
- [ ] Swap works correctly
- [ ] Copy translation works
- [ ] Clear input works

### Quick Translate

- [ ] Global shortcut is registered
- [ ] Global shortcut opens overlay
- [ ] Overlay translates selected text
- [ ] Overlay can copy translated text
- [ ] Overlay can open full app
- [ ] Overlay closes on `Esc`

### Providers

- [ ] Google config validates correctly
- [ ] Google text translation works
- [ ] LibreTranslate endpoint validation works
- [ ] LibreTranslate text translation works
- [ ] Unsupported provider capabilities are shown correctly

### History

- [ ] History entry created after successful translation
- [ ] History search works
- [ ] History reopen works
- [ ] History single delete works
- [ ] History clear-all works
- [ ] History disable works

### Documents

- [ ] Documents screen visible
- [ ] File picker works
- [ ] Drag-and-drop works
- [ ] Capability gating works
- [ ] Unsupported state message shown correctly
- [ ] Successful translated file can be saved

### Security / Privacy

- [ ] Renderer cannot access raw credentials
- [ ] Logs redact sensitive data
- [ ] Clipboard read occurs only after explicit shortcut invocation
- [ ] No telemetry enabled by default

## 19. Explicit Decisions

1. The application is desktop-only.
2. The application is client-only.
3. The repository is MIT.
4. LibreTranslate server remains external.
5. The common UX is provider-neutral and DeepL-style.
6. Provider-specific advanced enterprise features are excluded.
7. All provider communication is handled in Electron main process.
8. Local history is part of the initial release.
9. Global shortcut translation is part of the initial release.
10. Document translation is capability-gated, not assumed.

## 20. Final PRD Statement

OpenTranslate Desktop is a MIT-licensed Electron desktop translator built with Nuxt 4 and Nuxt UI. It is designed to reproduce the DeepL-style desktop translation workflow while allowing the user to choose between Google Cloud Translation and LibreTranslate. The product supports text translation, quick translation from any application, local translation history, and document translation when the active provider supports it. It runs on macOS, Windows, and Linux and is explicitly defined as a desktop client, not a bundled translation server.
