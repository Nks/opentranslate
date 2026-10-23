# Installation

OpenTranslate Desktop `0.1.1` ships as a pre-release without a Developer ID
or Authenticode certificate. The macOS app is **ad-hoc signed** (sealed but
not notarized) and the Windows installer is **unsigned**, so both must be
allowed past Gatekeeper and SmartScreen once, on first launch. The Linux
AppImage and `.deb` require no bypass.

Download the latest binaries from the GitHub releases page:

<https://github.com/Nks/opentranslate/releases/latest>

---

## macOS

### Download

| Architecture | File |
|---|---|
| Apple Silicon (M-series) | `opentranslate-desktop-0.1.1-mac-arm64.dmg` |
| Intel | `opentranslate-desktop-0.1.1-mac-x64.dmg` |

### Install

1. Open the `.dmg`.
2. Drag **OpenTranslate Desktop.app** into the **Applications** folder.
3. Eject the disk image.

### First open (Gatekeeper)

The app is ad-hoc signed but not notarized by Apple, so the first open is
blocked with a message similar to *"Apple could not verify "OpenTranslate
Desktop" is free of malware…"* (older macOS: *"…can't be opened because
Apple cannot check it for malicious software"*). Allow it once with either
path; macOS remembers the decision.

**Path A — System Settings (no Terminal):**

1. Open **OpenTranslate Desktop** from `/Applications` once and dismiss the
   warning with **Done** (or **OK**).
2. Open **System Settings → Privacy & Security**, scroll to **Security**,
   and click **Open Anyway** next to the OpenTranslate Desktop entry.
3. Confirm with **Open Anyway** and your password or Touch ID.

On macOS 14 and earlier, Control-clicking the app and choosing **Open**
offers the same **Open** button directly.

**Path B — Terminal (one command):**

```bash
xattr -dr com.apple.quarantine "/Applications/OpenTranslate Desktop.app"
```

Then launch normally from Launchpad or Spotlight.

**"OpenTranslate Desktop is damaged and can't be opened."** That message
means the bundle's code signature is missing or broken, not that the
download is corrupt; it appeared on early `0.1.0` builds whose bundle was
never sealed, and offers no **Open Anyway** button. Download the current
release (and check its SHA-256 below). Path B also clears it.

### First-run notes

- Quick-translate requires **Accessibility** permission. macOS prompts on
  first shortcut use; grant the permission in **System Settings → Privacy
  & Security → Accessibility**.
- The tray icon lives in the menu bar (top-right).

---

## Windows

### Download

| Format | File |
|---|---|
| Installer | `opentranslate-desktop-0.1.1-win-x64-setup.exe` |
| Portable zip | `opentranslate-desktop-0.1.1-win-x64.zip` |

### Install (recommended — NSIS installer)

1. Run `opentranslate-desktop-0.1.1-win-x64-setup.exe`.
2. **SmartScreen** blocks the unsigned installer with a blue prompt:
   *"Windows protected your PC."* Click **More info** → **Run anyway**.
3. Follow the installer; choose an installation directory or accept the
   default (per-user, no admin elevation required).

### Install (portable — no installer)

1. Extract `opentranslate-desktop-0.1.1-win-x64.zip` to a directory you own
   (e.g. `%LOCALAPPDATA%\OpenTranslate Desktop\`).
2. Launch `OpenTranslate Desktop.exe`. SmartScreen may prompt the same
   way as for the installer; click **More info** → **Run anyway**.

### First-run notes

- Quick-translate uses global low-level keyboard hooks via `uiohook-napi`.
  Antivirus tools occasionally flag this as suspicious; whitelist the
  installation directory if your AV blocks the hook registration.
- The tray icon lives in the notification area (system tray).

---

## Linux

### Download

| Format | File |
|---|---|
| AppImage | `opentranslate-desktop-0.1.1-linux-x86_64.AppImage` |
| Debian / Ubuntu | `opentranslate-desktop-0.1.1-linux-amd64.deb` |

### Install — AppImage

```bash
chmod +x opentranslate-desktop-0.1.1-linux-x86_64.AppImage
./opentranslate-desktop-0.1.1-linux-x86_64.AppImage
```

To integrate the AppImage with your desktop (icon + menu entry), install
[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) and
open the AppImage once; it will offer to register the app.

### Install — Debian / Ubuntu

```bash
sudo dpkg -i opentranslate-desktop-0.1.1-linux-amd64.deb
sudo apt-get install -f
```

The second command resolves any missing dependencies. Launch from your
application menu or run `opentranslate-desktop` from a terminal.

### First-run notes

- The system tray icon requires a working **StatusNotifierItem** host. On
  GNOME, install the [AppIndicator and KStatusNotifierItem
  Support](https://extensions.gnome.org/extension/615/appindicator-support/)
  extension. On KDE, Xfce, MATE, Cinnamon, and Budgie the tray is
  supported out of the box.
- Quick-translate global shortcuts work under X11 directly. Under
  Wayland the implementation depends on portal availability and is
  best-effort for `0.1.1`.

---

## Verify download

Each release ships one `SHA256SUMS.txt` listing the SHA-256 of every
installer. Download it next to the installer you picked.

### macOS / Linux

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

The command checks only the files present in the directory and prints
`OK` for each clean match (`sha256sum -c SHA256SUMS.txt --ignore-missing`
works the same on Linux).

### Windows (PowerShell)

```powershell
$file     = "opentranslate-desktop-0.1.1-win-x64-setup.exe"
$expected = (Select-String -Path SHA256SUMS.txt -Pattern ([regex]::Escape($file))).Line.Split(" ")[0]
$actual   = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
if ($expected -eq $actual) { "OK" } else { "MISMATCH" }
```

A `MISMATCH` result means the file is corrupt or tampered with — do
**not** install it; re-download from the official release page.

### Build provenance (GitHub CLI)

Every installer and `SHA256SUMS.txt` carries a signed build-provenance
attestation from the release workflow. With the
[GitHub CLI](https://cli.github.com/) installed:

```bash
gh attestation verify opentranslate-desktop-0.1.1-mac-arm64.dmg --repo Nks/opentranslate
```

A passing check proves the file was built by this repository's release
workflow from the tagged commit.

---

## Troubleshooting

### Inspect a packaged build (DevTools)

DevTools are disabled in release builds. To open them for support or
bug diagnosis, launch the app with the `OPENTRANSLATE_DEVTOOLS=1`
environment variable. DevTools open detached on startup.

**macOS**

```bash
OPENTRANSLATE_DEVTOOLS=1 "/Applications/OpenTranslate Desktop.app/Contents/MacOS/OpenTranslate Desktop"
```

**Windows (PowerShell)**

```powershell
$env:OPENTRANSLATE_DEVTOOLS=1; & "$env:LOCALAPPDATA\Programs\OpenTranslate Desktop\OpenTranslate Desktop.exe"
```

**Linux**

```bash
OPENTRANSLATE_DEVTOOLS=1 ./opentranslate-desktop-0.1.1-linux-x86_64.AppImage
```

Without the variable, DevTools and their keyboard shortcuts stay
disabled. Add `--enable-logging` to also stream Chromium and renderer
console output to the terminal.

---

## Reporting issues

File issues at <https://github.com/Nks/opentranslate/issues>. Please
include:

- OS and version (e.g. *macOS 14.5 / Windows 11 23H2 / Ubuntu 24.04*).
- Architecture (x64 / arm64).
- OpenTranslate Desktop version (Help → About, or the filename you
  downloaded).
- Provider in use (Google / LibreTranslate) and whether the issue
  reproduces with the other provider.
- Steps to reproduce; what you expected versus what happened.
- Relevant log excerpts. Logs live under:
  - macOS: `~/Library/Logs/OpenTranslate Desktop/`
  - Windows: `%APPDATA%\OpenTranslate Desktop\logs\`
  - Linux: `~/.config/OpenTranslate Desktop/logs/`

Do **not** paste service-account JSON, API keys, or full translation
content into issue reports. Logs redact secrets by default; translation
content is not logged unless you enable verbose logging in advanced
settings.
