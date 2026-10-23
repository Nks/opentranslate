# Packaging

OpenTranslate Desktop uses [electron-builder](https://www.electron.build/)
to produce platform-specific installers. Every release target is built
natively, verified by inspecting its native binaries, and smoke-tested as
a packaged app before upload.

---

## Release Targets

| Platform | Arch | CI runner | Artifacts |
|---|---|---|---|
| macOS | arm64 | `macos-latest` (Apple Silicon) | `opentranslate-desktop-<ver>-mac-arm64.dmg` |
| macOS | x64 | `macos-26-intel` (native Intel) | `opentranslate-desktop-<ver>-mac-x64.dmg` |
| Windows | x64 | `windows-latest` | `opentranslate-desktop-<ver>-win-x64-setup.exe`, `opentranslate-desktop-<ver>-win-x64.zip` |
| Linux | x64 | `ubuntu-latest` | `opentranslate-desktop-<ver>-linux-x86_64.AppImage`, `opentranslate-desktop-<ver>-linux-amd64.deb` |

The supported set lives in `scripts/packaging/targets.ts`
(`SUPPORTED_TARGETS`). Any other platform-arch pair is rejected by both
`package.mjs` and `verify-package.mjs`. Linux arm64 is deliberately absent:
`uiohook-napi@1.5.5` ships an x86-64 ELF in its `prebuilds/linux-arm64`
folder.

Artifact names come from `artifactName` in `electron-builder.yml`
(`${name}-${version}-${os}-${arch}.${ext}`, NSIS adds `-setup`). The
`${arch}` macro is electron-builder's per-format arch name, so AppImage
uses `x86_64` and deb uses `amd64`. Every name contains the arch, so the
four CI jobs can be merged into one release without collisions. No
platform- or target-level `artifactName` override is allowed; a unit test
enforces this.

All output lands in `release/<version>/`. Unpacked apps sit next to the
installers: `mac/`, `mac-arm64/`, `win-unpacked/`, `linux-unpacked/`.

---

## Build Pipeline

`pnpm run package` runs `scripts/package.mjs`, which executes the plan
from `scripts/packaging/package-plan.ts`:

1. `pnpm run build:electron` — esbuild bundles main + preload to CJS.
2. `pnpm run build:renderer` — Nuxt generates the static SPA in `.output/public/`.
3. For each arch: `electron-builder --<platform> --<arch> --publish never`.

No native module is rebuilt at any step (see [Native Modules](#native-modules)).

`--publish never` is always passed. `package.json` declares a GitHub
`repository`, so electron-builder would otherwise auto-publish on tag
builds that have `GH_TOKEN` and race the release job.

### Flags

| Command | Result |
|---|---|
| `pnpm run package` | Host platform, default arches (macOS: x64 then arm64; Windows/Linux: x64) |
| `node scripts/package.mjs --arch=arm64` | Host platform, single arch |
| `pnpm run package:dir` | Unpacked app only (`--dir`), no installers |

`pnpm run package --arch=x64` and `pnpm run package -- --arch=x64` work
too. Unknown flags fail fast.

---

## Native Modules

`better-sqlite3` and `uiohook-napi` are the runtime native modules.

Both are N-API modules with prebuilt binaries for every release target, so
nothing is compiled or rebuilt: there is no `postinstall`, no per-arch
`electron-rebuild` (`@electron/rebuild` is not a dependency) and
`npmRebuild: false`. The same binary loads in Node (Vitest) and in every
Electron version.

- **better-sqlite3** (v13+) ships `prebuilds/<platform>-<arch>.node` (plus
  `linuxmusl-*`) and loads the one for `process.platform`/`process.arch`
  before falling back to `build/Release`. Its `binding.gyp` only checks for
  that prebuild, so pnpm's install-time `node-gyp` run is a no-op that needs
  a C++ toolchain and leaves a `build/` dir; `package.json` lists it under
  `pnpm.ignoredBuiltDependencies` to skip it.
- **uiohook-napi** ships `prebuilds/<platform>-<arch>/uiohook-napi.node`,
  loaded by `node-gyp-build`. `node-gyp-build` prefers a compiled
  `build/Release` binary over prebuilds, and pnpm's side-effects cache can
  restore a host-arch compile there.
- `electron-builder.yml` therefore excludes `uiohook-napi/{build,bin}`,
  `better-sqlite3/{build,deps,src}` and `binding.gyp`, and every prebuild
  except `${platform}-${arch}`. Each packaged app carries exactly one
  binary per module, and a host-arch compile can never shadow it.
- Both modules plus `node-gyp-build` are unpacked from `app.asar`
  (`asarUnpack`).

Vitest never loads the SQLite native module. Unit tests inject a fake
`HistoryStore` at the interface boundary, so the unit suite needs no ABI
rebuild.

---

## Verify a Package

```bash
node scripts/verify-package.mjs --platform <mac|win|linux> --arch <x64|arm64>
```

It reads `name`/`version` from `package.json` and `productName`, the output
dir and the artifact name patterns from `electron-builder.yml`. Then it checks:

- Every expected installer exists and is non-empty.
- The main executable exists and its binary header matches the target, so
  an x64 Electron inside the mac-arm64 app fails.
- On mac, `codesign --verify --deep --strict` accepts the `.app` bundle
  (code signature seals its resources;
  `scripts/packaging/code-signature.ts`).
- `app.asar` exists.
- The `better-sqlite3` and `uiohook-napi` prebuilds for the target
  platform-arch are present in `app.asar.unpacked` and match the target,
  judged by their binary headers (Mach-O `cputype`, including universal
  slices; PE `Machine`; ELF `e_machine`).
- Every other loadable `.node` in `app.asar.unpacked` matches too. That
  catches a host-arch compile leaking into a cross-arch build.

Binaries the target never loads are not checked: prebuilds for other
platforms (directory, single-file or combined `darwin-x64+arm64` layout)
are skipped, and npm platform packages whose `os`/`cpu` exclude the target
are listed with `–`.

Each check prints `✓` or `✗`. Any failure exits 1.

`--print executable` and `--print installers` print absolute paths, one per
line, and exit 1 if any are missing. CI uses them to set the smoke test's
executable and the upload list.

`verify-package.mjs` only resolves paths and prints. The checks themselves
(`scripts/packaging/verify-checks.ts`, with an injected read-only file
system), the header parser (`binary-arch.ts`), naming and layout rules
(`artifact-layout.ts`) and native-binary selection (`native-binaries.ts`)
are unit-tested under `tests/unit/packaging/`. That includes the real
uiohook-napi prebuilds for darwin, win32 and linux.

The `.mjs` entry points import the `.ts` modules directly through Node 24's
built-in type stripping. Inside `scripts/packaging/` the modules import
each other as `./sibling.ts` (never through the `@scripts` alias, which
Node cannot resolve). `scripts/tsconfig.json` enables `erasableSyntaxOnly`,
`verbatimModuleSyntax` and `allowImportingTsExtensions`, and
`pnpm typecheck` runs it, so non-erasable syntax or an unloadable import
fails typecheck instead of breaking `node scripts/*.mjs`.

---

## Packaged Smoke Test

`tests/e2e/packaged-app.e2e.ts` launches the **packaged** executable through
Playwright's `_electron.launch({ executablePath })`. It runs with a fresh
`--user-data-dir` in the OS temp dir, so it never touches a real profile and
never collides with a running instance's single-instance lock.
`--use-mock-keychain` / `--password-store=basic` keep it off the OS keyring.
Without them, an unsigned rebuild blocks startup on a macOS Keychain access
prompt for "OpenTranslate Desktop Safe Storage". It asserts:

- `app.isPackaged` is true and `userData` is the temp dir.
- The window is on `app://app/`, the SPA renders (top bar plus the
  first-run "Configure a provider" empty state), so the window is not blank.
- `window.api.history.add` → `history.list` round-trips through the preload
  bridge and `history.db` appears in the temp profile. This proves
  better-sqlite3 loads inside the packaged app.
- `uiohook-napi` loads from `app.asar.unpacked` in the main process.

```bash
OPENTRANSLATE_PACKAGED_APP="$(node scripts/verify-package.mjs --platform mac --arch arm64 --print executable)" \
  pnpm run test:e2e:packaged
```

The test lives in its own Playwright project (`electron-packaged`).
`pnpm test:e2e` runs only `electron-dev`. The packaged test also skips
itself when `OPENTRANSLATE_PACKAGED_APP` is unset. On Linux, wrap the
command in `xvfb-run`. The mac x64 build can be smoke-tested on Apple
Silicon, where it runs under Rosetta.

### Linux from an Apple Silicon Mac (Docker)

```bash
docker run --rm --platform linux/amd64 \
  -v "$PWD":/project \
  -v opentranslate-linux-nm:/project/node_modules \
  -v opentranslate-electron-cache:/root/.cache/electron \
  -v opentranslate-builder-cache:/root/.cache/electron-builder \
  node:24-bookworm bash -c '
    corepack enable && corepack prepare pnpm@10.34.7 --activate &&
    pnpm install --frozen-lockfile --store-dir=/project/node_modules/.pnpm-store &&
    node scripts/package.mjs --arch=x64 &&
    node scripts/verify-package.mjs --platform linux --arch x64'
```

`node_modules` must be a named volume, so the Linux install never clobbers
the host's macOS `node_modules`. The pnpm store must live on that same
volume. Otherwise pnpm cannot hardlink across filesystems and the emulated
container dies with `ERR_PNPM_ENOMEM`.

To smoke-test inside the container, install `xvfb` plus the Electron
runtime libraries. Copy `linux-unpacked` to a container-local path and make
`chrome-sandbox` `root:root 4755`, as the deb postinst does. Then run the
Playwright command as a non-root user under `xvfb-run`, because Electron
refuses to run as root without `--no-sandbox`.

---

## CI and Release Flow

| Workflow | Trigger | Does |
|---|---|---|
| `checks.yml` | `workflow_call` | Lint, typecheck, unit + integration, dev e2e on ubuntu/macos/windows |
| `package.yml` | `workflow_call`, `workflow_dispatch` | 4-target matrix: install → package → verify → packaged smoke → upload `package-<platform>-<arch>` |
| `ci.yml` | push to `master`/`develop`; PRs to `master`/`develop` (one run per PR) | `checks.yml`, then `package.yml` |
| `release.yml` | tag `v*` | version guard → `checks.yml` → `package.yml` (no dependency cache) → publish |

The release publish job:

1. Refuses to run when the tag already has a published (non-draft)
   release; a draft is updated in place.
2. Downloads every `package-*` artifact into one folder.
3. Asserts exactly 6 installers are present (a unit test ties the count to
   `SUPPORTED_TARGETS`).
4. Writes `SHA256SUMS.txt`.
5. Attests build provenance (`actions/attest-build-provenance`) for the six
   installers and `SHA256SUMS.txt`; verify with `gh attestation verify`
   (see [install.md](install.md#verify-download)).
6. Creates a **draft pre-release** (`draft: true`, `prerelease: true`,
   `generate_release_notes: true`). It attaches only `.dmg`, `.exe`, `.zip`,
   `.AppImage`, `.deb` and `SHA256SUMS.txt`, with no `latest*.yml` update
   metadata and no blockmaps. Auto-update is not wired yet (backlog B-G-19).

The version guard fails the run when the tag is not `v` + the
`package.json` version.

### Workflow hardening

- Every workflow defaults the token to `contents: read`. Only the release
  publish job gets `contents: write` (plus `id-token: write` and
  `attestations: write` for provenance), the scanning jobs get
  `security-events: write`, and gitleaks gets `pull-requests: read` with
  PR comments off.
- Every `actions/checkout` sets `persist-credentials: false`.
- Every third-party action is pinned to a full commit SHA with a trailing
  `# vX.Y.Z` comment, including inside the composite actions. The Semgrep
  image is pinned by digest to a release at least 7 days old, and the
  license checker by version. Dependabot updates both the npm and
  github-actions ecosystems (workflows and `.github/actions/*`) with a
  7-day cooldown; it does not track the Semgrep image (B-063).
- Shared setup lives in composite actions: `setup-workspace` (pnpm from
  `packageManager`, Node from `.nvmrc`, frozen install, `cache` input) and
  `linux-electron-deps` (xvfb + Electron/uiohook runtime libraries).
- Every runner job sets `timeout-minutes` (checks 30, package 45).
- No `run:` script interpolates `${{ … }}`; matrix values and paths reach
  scripts through `env` (zizmor template-injection).
- `pnpm/action-setup` has no `version` input. It reads `packageManager`
  from `package.json`.
- Release builds skip the Actions dependency cache to avoid cache poisoning.
- `package.yml` runs its steps under `bash` on every runner, including
  Windows (`defaults.run.shell`). `checks.yml` keeps each runner's default
  shell because its steps are plain `pnpm` commands; composite action steps
  always declare `shell: bash`.

### Creating a release

```bash
pnpm version 0.2.0 --no-git-tag-version   # bump package.json
git commit -am "chore(release): 0.2.0"
git tag v0.2.0
git push origin v0.2.0
```

Review the draft on the GitHub releases page, then publish it.

---

## Code Signing

macOS bundles are **ad-hoc signed** (`mac.identity: '-'`; in
electron-builder 26 `mac.sign` is a custom-sign hook, the v27
`mac.sign.identity` key does not exist yet), with `hardenedRuntime: false`,
`notarize: false` and an unsigned DMG (`dmg.sign: false`). Ad-hoc signing
seals `Info.plist` and every resource, so a quarantined download gets the
regular "cannot verify" prompt with **Open Anyway** instead of "damaged" (an
unsealed bundle with only the linker's ad-hoc executable signature fails
`codesign --verify --deep --strict` with "code has no resources but
signature indicates they must be present"). `verify-package` runs that
`codesign` check on every mac target. Windows NSIS stays unsigned. See
[install.md](install.md) for the Gatekeeper/SmartScreen bypass and
checksum verification, and [apple-signing.md](apple-signing.md) for the
future signing path. For Windows, set `WIN_CSC_LINK` and
`WIN_CSC_KEY_PASSWORD` with an Authenticode certificate. Linux needs no
signing.

### Future hardening

Flipping Electron fuses (`RunAsNode`, `EnableNodeCliInspectArguments`, …)
would harden release binaries. It would also stop Playwright from attaching
to the packaged app, so the packaged smoke test would need a fuse-free
variant first. This is not done yet.

---

## Troubleshooting

### macOS Gatekeeper blocks the app, or says it is "damaged"

The ad-hoc signed app is not notarized: open it once, then **System
Settings → Privacy & Security → Open Anyway**, or run
`xattr -dr com.apple.quarantine "/Applications/OpenTranslate Desktop.app"`
(see [install.md](install.md#first-open-gatekeeper)). "Damaged" means the
bundle is not sealed; `verify-package` fails such a build on its
`code signature` check.

### `verify-package` reports an arch mismatch

The package contains a native binary built for another arch. Usually a
host-arch compile leaked in. Check that the `files` exclusions for
`better-sqlite3` and `uiohook-napi` in `electron-builder.yml` are intact,
then re-run `node scripts/package.mjs --arch=<arch>`.

### Large installer size

The Nuxt renderer, the Electron framework and the native modules add up to
~150-200 MB per installer. That is normal for Electron apps.
