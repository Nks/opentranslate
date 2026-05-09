# Packaging

OpenTranslate Desktop uses [electron-builder](https://www.electron.build/)
to produce platform-specific installers.

---

## Build Pipeline

Three sequential stages:

1. **`pnpm build:electron`** — esbuild bundles main + preload to CJS
2. **`pnpm build:renderer`** — Nuxt generates static SPA in `.output/public/`
3. **`electron-builder`** — packs everything into platform installers

---

## Quick Start

### Full installer (current OS)

```bash
pnpm package
```

### Unpacked directory (for inspection)

```bash
pnpm package:dir
```

### Full build without packaging

```bash
pnpm build
```

---

## Platform Targets

| Platform | Format | Architecture | Output |
|---|---|---|---|
| macOS | DMG | x64, arm64 | `release/<version>/OpenTranslate Desktop-<ver>-<arch>.dmg` |
| Windows | NSIS | x64 | `release/<version>/OpenTranslate Desktop Setup <ver>.exe` |
| Windows | ZIP | x64 | `release/<version>/OpenTranslate Desktop-<ver>-win.zip` |
| Linux | AppImage | x64 | `release/<version>/OpenTranslate Desktop-<ver>.AppImage` |
| Linux | deb | x64 | `release/<version>/opentranslate-desktop_<ver>_amd64.deb` |

---

## Configuration

### electron-builder.yml

Main configuration file. Key settings:

```yaml
appId: com.opentranslate.desktop
productName: OpenTranslate Desktop
files:
  - dist-electron/**/*
  - .output/public/**/*
  - package.json
asar: true
asarUnpack:
  - '**/*.{node,dll}'
npmRebuild: true
```

### Build Resources

```
build/
  entitlements.mac.plist    macOS entitlements (for signed builds)
  icon.png                  1024x1024 app icon
```

electron-builder generates `.icns` (macOS) and `.ico` (Windows) from `icon.png`.

---

## Native Modules

The only native module is `uiohook-napi` (global key observer for
quick-translate). It ships prebuilt binaries for every supported
platform via `node-gyp-build`, so no manual rebuild is required for
either development or packaging. `electron-builder` keeps
`npmRebuild: true` as a belt-and-braces fallback in case a platform
ever needs a source build.

Translation history is persisted as a plain JSON file under
Electron's `userData` (`history.json`), so the app does not depend on
a compiled database engine.

---

## Code Signing

### Current state

Signing is disabled (`identity: null` in `electron-builder.yml`).

### macOS

See [docs/apple-signing.md](apple-signing.md) for the full guide.

### Windows

Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` environment variables
with an Authenticode certificate.

### Linux

No code signing required for AppImage or deb.

---

## CI Release

`.github/workflows/release.yml` runs on `v*` tags:

1. Lint + typecheck + test
2. Build (electron + renderer)
3. Package per platform (matrix: macOS, Windows, Linux)
4. Upload to GitHub Release (draft)

### Creating a release

```bash
# Update version in package.json
pnpm version 0.2.0

# Tag and push
git tag v0.2.0
git push origin v0.2.0
```

The release workflow triggers automatically and creates a draft release
with all platform artifacts.

---

## Troubleshooting

### macOS Gatekeeper blocks unsigned app

Right-click the app > Open > Open (first launch only). For proper
distribution, follow the [Apple signing guide](apple-signing.md).

### Large installer size

The Nuxt renderer + Electron framework + native modules produce ~150-200 MB
installers. This is normal for Electron apps. Unused `node_modules` are
excluded via the `files` config.
