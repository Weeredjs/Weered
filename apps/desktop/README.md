# Weered Desktop

Native desktop shell for Weered — built on **Tauri 2 + Rust**.

- Native webview (WebView2 / WKWebView / WebKitGTK), not bundled Chromium
- ~5–8 MB installer, ~80 MB RAM (vs Electron's 150 MB / 400 MB)
- System tray, native notifications, global hotkeys, deep links, autostart, auto-updater
- Hide-on-close behavior (closing the window minimizes to tray; tray menu quits)

## What it does

The shell loads `https://weered.ca` in a native webview — the entire web app runs unchanged. The Rust shell adds:

| Feature                  | How                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **System tray**          | Tray icon with menu: Open Weered, Jump to (Home / Lobbies / DMs / Crews), About, Quit |
| **Hide to tray**         | Closing the window minimizes; quit only via tray menu                                 |
| **Single instance**      | Re-launching the app focuses the existing window instead of opening a second one      |
| **Global hotkey**        | `Ctrl+Shift+W` (or `Cmd+Shift+W`) toggles the main window from anywhere               |
| **Deep links**           | `weered://lobby/123` opens lobby 123 in the running app (or launches it)              |
| **Auto-launch on boot**  | Optional, opt-in toggle (uses launch-agent on macOS, registry on Windows)             |
| **Native notifications** | Routed through OS notification center via Tauri notification plugin                   |
| **Window state**         | Window size and position remembered between launches                                  |
| **Auto-updater**         | Checks `https://weered.ca/desktop/updates/{target}/{version}` for new builds          |

## Prerequisites

- **Node 20+** and **pnpm 10+**
- **Rust stable** (`rustup install stable`)
- **Platform-specific webview deps:**
  - **Windows:** WebView2 (preinstalled on Win 11; auto-installed on Win 10 by Tauri bundler)
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Linux:** `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

## Develop

```bash
cd apps/desktop
pnpm install
pnpm dev      # Opens the desktop app pointing at https://weered.ca with hot DevTools
```

The dev URL is configured in `src-tauri/tauri.conf.json` → `build.devUrl`. Change to `http://localhost:3000` (or wherever your local web app runs) to test against local changes.

## Build production installer

```bash
pnpm build
```

Output:

- **Windows:** `src-tauri/target/release/bundle/nsis/Weered_0.1.0_x64-setup.exe` and `bundle/msi/Weered_0.1.0_x64_en-US.msi`
- **macOS:** `src-tauri/target/release/bundle/dmg/Weered_0.1.0_x64.dmg` and `bundle/macos/Weered.app`
- **Linux:** `src-tauri/target/release/bundle/deb/weered_0.1.0_amd64.deb` and `bundle/appimage/weered_0.1.0_amd64.AppImage`

## Generate icons

When you have a new source logo, regenerate the full platform icon set from a 1024x1024 source PNG:

```bash
pnpm icon   # reads src-tauri/icons/source.png, writes 32x32, 128x128, .icns, .ico, etc.
```

## Auto-update wiring (server side)

The updater hits `https://weered.ca/desktop/updates/{target}/{current_version}` and expects a JSON response in this shape:

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and the new Launch Pad",
  "pub_date": "2026-04-25T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://weered.ca/desktop/Weered_0.2.0_x64-setup.exe"
    },
    "darwin-x86_64": { "signature": "...", "url": "https://..." },
    "linux-x86_64": { "signature": "...", "url": "https://..." }
  }
}
```

A 204 response means "no update available". Sign each release with `pnpm tauri signer sign` and put the public key in `tauri.conf.json` → `plugins.updater.pubkey`.

## Architecture

```
apps/desktop/
├── package.json                # @tauri-apps/cli + @tauri-apps/api
├── dist/index.html             # Splash fallback (auto-redirects to weered.ca)
└── src-tauri/
    ├── Cargo.toml              # Rust deps: tauri 2 + plugins
    ├── tauri.conf.json         # Window, bundle, plugins config
    ├── build.rs                # Tauri build script
    ├── capabilities/default.json  # Permission allowlist (Tauri 2 security model)
    ├── icons/                  # Platform icons (source.png → all targets)
    └── src/
        ├── main.rs             # Entry point (Windows console-suppression)
        └── lib.rs              # Tray, hotkeys, deep links, single-instance, hide-on-close
```

## Shipping a release to users

End-to-end: tag a commit → GitHub Actions builds Mac + Windows + Linux installers in parallel → publishes to GitHub Releases → API auto-detects + serves the manifest → existing installs auto-update on next launch → website download buttons go live.

### One-time setup (you do this, just once)

**1. Generate the Tauri updater signing key:**

```powershell
cd C:\Weered\apps\desktop
pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\weered_updater.key"
```

- Choose a password when prompted (you'll need it again — save in 1Password).
- Outputs the public key string to stdout.
- Outputs the private key to `~/.tauri/weered_updater.key`.

**2. Add the public key to `src-tauri/tauri.conf.json`:**

```json
"plugins": {
  "updater": {
    "endpoints": ["..."],
    "pubkey": "<paste public key here>"
  }
}
```

**3. Add GitHub Secrets** (https://github.com/Weeredjs/Weered/settings/secrets/actions):

- `TAURI_SIGNING_PRIVATE_KEY` → paste the entire contents of `~/.tauri/weered_updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` → the password you chose

**4. (Optional, later) Apple code signing** — add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` secrets when you have a Developer Program account ($99/yr). Without them macOS users see a Gatekeeper warning ("right-click → Open").

### Releasing a new version

```bash
# 1. Bump version in 3 places (must match):
#    apps/desktop/package.json
#    apps/desktop/src-tauri/Cargo.toml
#    apps/desktop/src-tauri/tauri.conf.json

# 2. Commit + tag
git add apps/desktop
git commit -m "desktop: v0.2.0"
git tag desktop-v0.2.0
git push origin main --tags

# 3. GitHub Actions runs ~15 min.
# 4. Once it publishes, the API picks up the release within 5 min (cache TTL).
# 5. weered.ca/desktop shows live download buttons.
# 6. Existing installs auto-update on next launch.
```

### How the auto-update works

- Tauri client polls `https://api.weered.ca/desktop/updates/{target}/{current_version}` on launch.
- API fetches latest desktop release from GitHub Releases (cached 5 min).
- Returns 204 if no update or already current.
- Returns signed manifest if update is available — Tauri downloads + verifies the signature against the public key in `tauri.conf.json` → installs on next restart.

If GitHub Releases is down or returns nothing, the API serves whatever was last cached, then falls back to 204. Desktop clients never error — they just keep running their current shell.

## Why Tauri (vs Electron)

|                  | Electron                     | Tauri 2               |
| ---------------- | ---------------------------- | --------------------- |
| Installer size   | ~150 MB                      | **~5–8 MB**           |
| RAM per instance | ~400 MB                      | **~80 MB**            |
| Engine           | Bundled Chromium             | OS-native webview     |
| Backend          | Node.js                      | **Rust**              |
| Security         | Loose (full Node by default) | Allowlist permissions |
| Ship date of v2  | —                            | Late 2024             |

Brand pitch: _"Built on Rust + Tauri — 30x smaller than Discord."_
