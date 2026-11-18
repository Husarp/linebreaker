# Linebreaker desktop (Tauri 2)

Run `npm ci` and `npm run desktop:dev` from the repository. The shared `npm run build:web` step copies the static game, fonts, and desktop scripts into ignored `dist-web/`. Do not distribute third-party music without permission. The cyan L-mino and generated icons are placeholders; after replacing `src-tauri/icon.svg`, run `npx tauri icon src-tauri/icon.svg`.

F11 toggles fullscreen. Desktop saves use the existing serialized queue and live in `%APPDATA%\com.husarp.linebreaker`, not in the installation folder. Writes sync and rename a temporary file and keep `save.bak`. If both copies are unreadable the app blocks writes; back up the directory before attempting recovery.

## Install, update, and uninstall

`LinebreakerSetup-X.Y.Z.exe` installs for the current Windows user without elevation and offers **Update** or **Uninstall** when the app is already registered. The default install directory is `%LOCALAPPDATA%\Linebreaker`; upgrades reuse the previous location. Uninstall is also available in Windows Settings. **Also delete my data** is off by default.

The custom NSIS template stages the package and runs the same Linebreaker-themed setup window for install, update, and removal. The window uses the game's palette and embedded Orbitron/Inter fonts. Manual setup asks before closing a running game, then copies files, registers the app, and creates shortcuts on a worker thread. It shows a determinate progress bar and expandable details. At the end, **Run Linebreaker now** is selected by default. Failed changes are rolled back where possible and the old version is restarted; the window stays open with details and **TRY AGAIN**. If Windows prevents recovery, the log identifies the error and the backup folders are kept.

On Windows, the app checks GitHub at launch and on return, at most once every five minutes per session. Use **Settings → Desktop updates** for opt-out, **CHECK NOW**, **GITHUB**, and **GET UPDATE**. Dismissing the main-menu banner hides it until restart. The app displays the update size, amount downloaded, and transfer speed; failures offer **TRY AGAIN** and **GITHUB** without automatically opening the browser. Tauri's updater verifies the download signature before the app writes the versioned Setup.exe to its cache and runs it. The app flushes pending saves and exits; setup shows progress only, restarts the game, and closes. The game removes the temporary installer after restart.

## Windows release

Build on Windows x64 with Node.js LTS, stable Rust (`x86_64-pc-windows-msvc`), the Visual Studio C++ Build Tools/Windows SDK, .NET Framework 4.8 and its in-box C# compiler, Python 3 (`py`), and `py -3 -m pip install fonttools brotli` to convert the bundled Inter font. The build machine needs WebView2 for the smoke test. Tauri fetches NSIS and the WebView2 bootstrapper on first bundle; a machine without WebView2 needs internet access during installation.

Create or confirm the GitHub release repository. `Husarp/linebreaker` is a **placeholder**: set the real `/releases/latest/download/latest.json` endpoint in `src-tauri/tauri.conf.json` and set the matching `/releases*` URL scope in `src-tauri/capabilities/default.json`.

Keep the signing pair outside the repository. For example, in PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.linebreaker-keys"
npx tauri signer generate -w "$env:USERPROFILE\.linebreaker-keys\updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.linebreaker-keys\updater.key"
```

Back up the private key and set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` via a secret if needed. Put only the generated **public** key into `plugins.updater.pubkey`. These signatures are for the Tauri updater, not Windows Authenticode. Do not rotate the updater key without a migration for installed versions.

1. Run `npm ci`, then `npm run desktop:release -- X.Y.Z --notes-file release-notes.md` (notes are optional). This synchronizes the Tauri, Cargo, and npm version files from the supplied version, refreshes `Cargo.lock`, checks tracked files for common release exclusions, and runs `cargo check` and `npm test`. The build rejects version mismatches. Before NSIS bundling, the already-built release app opens its packaged WebView with isolated data and must report the expected version within 30 seconds. To build the current version without staging release assets, use `npm run desktop:build`.
2. Review `git ls-files` for private saves, notes, drafts, logs, test builds, or signing material not covered by the automated exclusions. Review the version and lockfile changes. Tag the intended source as `vX.Y.Z` before publishing.
3. On Windows, verify fresh install (including a machine without WebView2), Update/Cancel with the app running, failure/retry and rollback, and the finish/restart behavior. Check 125% and 150% scaling, F11, upgrade/save preservation, and both uninstall choices. From an older signed build, verify the full in-app update and cleanup. These are Windows release gates, not covered by the Linux `cargo check` or packaged startup smoke test.
4. From `release/windows/X.Y.Z/`, use the script's printed `gh release create` command to publish the versioned Setup.exe, its `.sig`, and `latest.json` in a stable release marked **Latest**. The manifest gives Tauri the exact installer URL, updater signature, and size for `windows-x86_64`. Confirm the public endpoint and recheck the signed update from the older build after publishing.
