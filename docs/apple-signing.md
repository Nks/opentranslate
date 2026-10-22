# Apple Code Signing & Notarization Guide

This guide covers signing and notarizing OpenTranslate Desktop for macOS
distribution outside the Mac App Store.

> **Current state:** Signing is disabled (`identity: null` in
> `electron-builder.yml`). Follow this guide to enable it when ready.

---

## 1. Enroll in Apple Developer Program

**URL:** https://developer.apple.com/programs/enroll/

- Cost: **$99 USD/year**
- Individual or organization account
- Organization enrollment requires a D-U-N-S number
- Enrollment takes 24–48 hours to process

---

## 2. Create Certificates

**URL:** https://developer.apple.com/account/resources/certificates/list

Navigate to **Certificates, Identifiers & Profiles > Certificates**.

### 2.1 Generate a Certificate Signing Request (CSR)

1. Open **Keychain Access** on your Mac
2. Menu: **Keychain Access > Certificate Assistant > Request a Certificate
   from a Certificate Authority**
3. Enter your email and common name
4. Select **Saved to disk**
5. Save the `.certSigningRequest` file

### 2.2 Create Developer ID Application certificate

1. Click the **+** button in the Certificates portal
2. Under **Software**, select **Developer ID Application**
3. Upload your CSR file
4. Download the `.cer` file
5. Double-click to install into Keychain Access

### 2.3 Create Developer ID Installer certificate (optional)

Only needed if distributing via `.pkg` format. Not required for DMG-only.

Same steps as 2.2, but select **Developer ID Installer**.

> Do **not** use "Mac App Distribution" or "Mac Installer Distribution" —
> those are for Mac App Store only.

---

## 3. Export .p12 Certificate

Needed for CI/CD and electron-builder.

1. Open **Keychain Access**
2. Left sidebar: **login** keychain, category **My Certificates**
3. Find **"Developer ID Application: Your Name (TEAM_ID)"**
4. Expand the triangle — confirm the private key is attached
5. Right-click the certificate > **Export...**
6. Format: **Personal Information Exchange (.p12)**
7. Set a strong password (this becomes `CSC_KEY_PASSWORD`)
8. Save the file

For CI, base64-encode it:

```bash
base64 -i certificate.p12 -o certificate-base64.txt
```

---

## 4. Find Your Team ID

**URL:** https://developer.apple.com/account > **Membership Details**

The Team ID is a 10-character alphanumeric string (e.g., `ABC1234DEF`).
It also appears in parentheses in your certificate name in Keychain Access.

---

## 5. Create App-Specific Password

Required for notarization. Apple ID two-factor authentication must be enabled.

**URL:** https://appleid.apple.com/account/manage

1. Sign in
2. Go to **Sign-In and Security > App-Specific Passwords**
3. Click **+** (Generate)
4. Label: `electron-notarize`
5. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

---

## 6. Configure electron-builder

### 6.1 Update `electron-builder.yml`

Replace the current unsigned config:

```yaml
# Before (unsigned)
mac:
  identity: null
  hardenedRuntime: false

# After (signed + notarized)
mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

notarize:
  teamId: "YOUR_TEAM_ID"
```

Key points:

- `hardenedRuntime: true` — **mandatory** for notarization
- `entitlements` — required for Electron (JIT, unsigned memory, network)
- `notarize.teamId` — electron-builder v24+ handles notarization natively

### 6.2 Verify entitlements

`build/entitlements.mac.plist` must include:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
  </dict>
</plist>
```

Already present in the repository.

---

## 7. Set Environment Variables

### Local builds

```bash
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC1234DEF"

pnpm package
```

### GitHub Actions (CI)

Add these as **repository secrets** in GitHub:

| Secret                        | Value                         |
|-------------------------------|-------------------------------|
| `CSC_LINK`                    | Base64-encoded `.p12` content |
| `CSC_KEY_PASSWORD`            | `.p12` export password        |
| `APPLE_ID`                    | Apple ID email                |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password         |
| `APPLE_TEAM_ID`               | 10-character Team ID          |

The `release.yml` workflow passes `GH_TOKEN` already. electron-builder auto-reads
the signing/notarization env vars when present.

To skip signing in CI (e.g., for PRs): set `CSC_IDENTITY_AUTO_DISCOVERY=false`.

---

## 8. Manual Notarization (debugging)

If automated notarization fails, use `notarytool` directly:

```bash
# Submit
xcrun notarytool submit "OpenTranslate Desktop.dmg" \
  --apple-id "you@example.com" \
  --team-id "ABC1234DEF" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --wait

# View rejection log
xcrun notarytool log <submission-id> \
  --apple-id "you@example.com" \
  --team-id "ABC1234DEF" \
  --password "xxxx-xxxx-xxxx-xxxx"

# Staple ticket to DMG (enables offline verification)
xcrun stapler staple "OpenTranslate Desktop.dmg"
```

### Store credentials in keychain (avoids repeating)

```bash
xcrun notarytool store-credentials "opentranslate-profile" \
  --apple-id "you@example.com" \
  --team-id "ABC1234DEF" \
  --password "xxxx-xxxx-xxxx-xxxx"

# Then use:
xcrun notarytool submit "OpenTranslate Desktop.dmg" \
  --keychain-profile "opentranslate-profile" \
  --wait
```

---

## 9. Verify Signing

After packaging:

```bash
# Check signature
codesign --verify --deep --strict "release/0.1.0/mac-arm64/OpenTranslate Desktop.app"

# Display signing details
codesign -dv --verbose=4 "release/0.1.0/mac-arm64/OpenTranslate Desktop.app"

# Check notarization status
spctl --assess --type execute --verbose "release/0.1.0/mac-arm64/OpenTranslate Desktop.app"
```

---

## 10. Important Notes

- **macOS 15 Sequoia:** Gatekeeper no longer allows Control-click bypass for
  unsigned apps. Proper signing + notarization is effectively mandatory for
  distribution.
- **altool retired:** Apple retired `xcrun altool` in November 2023. All
  notarization must use `notarytool`. electron-builder v24+ handles this.
- **Universal binaries:** Consider building `arch: [universal]` instead of
  separate x64/arm64 DMGs for simpler distribution.
- **Never commit certificates:** `.p12` files, passwords, and Apple IDs must
  be environment variables or CI secrets. Never in the repository.

---

## Quick Checklist

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] Developer ID Application certificate created
- [ ] Certificate exported as `.p12`
- [ ] App-specific password generated
- [ ] Team ID noted
- [ ] `electron-builder.yml` updated (hardenedRuntime, entitlements, notarize)
- [ ] Environment variables set (local or CI secrets)
- [ ] `pnpm package` — verify signed DMG output
- [ ] `codesign --verify` — confirms valid signature
- [ ] `spctl --assess` — confirms Gatekeeper acceptance
