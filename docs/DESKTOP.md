# Linebreaker desktop (Tauri 2)

Run `npm ci` and `npm run desktop:dev` from the repository. The shared `npm run build:web` step copies the static game, fonts, and desktop scripts into ignored `dist-web/`. Do not distribute third-party music without permission.

The master app icon is `assets/ui/app-icon-1024.png`. Run `npx tauri icon assets/ui/app-icon-1024.png --ios-color '#100d24' --output <staging-directory>` to regenerate the desktop and iOS sizes. Android uses the full Block L artwork in legacy launcher icons and separate foreground and background layers in adaptive icons. Don't overwrite either set with Tauri's default Android output.

F11 toggles fullscreen. Desktop saves use the existing serialized queue and live in `%APPDATA%\com.husarp.linebreaker`, not in the installation folder. Writes sync and rename a temporary file and keep `save.bak`. If both copies are unreadable the app blocks writes; back up the directory before attempting recovery.

## Install, update, and uninstall

`LinebreakerSetup-X.Y.Z.exe` installs for the current Windows user without elevation and offers **Update** or **Uninstall** when the app is already registered. The default install directory is `%LOCALAPPDATA%\Linebreaker`; upgrades reuse the previous location. Uninstall is also available in Windows Settings. **Also delete my data** is off by default.

The custom NSIS template stages the package and runs the same Linebreaker-themed setup window for install, update, and removal. The window uses the game's palette and embedded Orbitron/Inter fonts. Manual setup asks before closing a running game, then copies files, registers the app, and creates shortcuts on a worker thread. It shows a determinate progress bar and expandable details. At the end, **Run Linebreaker now** is selected by default. Failed changes are rolled back where possible and the old version is restarted; the window stays open with details and **TRY AGAIN**. If Windows prevents recovery, the log identifies the error and the backup folders are kept.

On Windows, the app checks GitHub at launch and on return, at most once every five minutes per session unless you select **CHECK NOW**. Use **Settings → Desktop updates** for opt-out, manual checks, **GITHUB**, and **GET UPDATE**. Dismissal applies to the offered version, not future updates. The app displays size, amount downloaded, and transfer speed; failures offer **TRY AGAIN** and **GITHUB** without automatically opening the browser. Tauri verifies the download signature before the app writes the versioned Setup.exe to its cache and runs it. The app flushes pending saves and exits; setup shows progress only, restarts the game, and closes. The game removes the temporary installer after restart.

## Windows release

Build on Windows x64 with Node.js LTS, stable Rust (`x86_64-pc-windows-msvc`), the Visual Studio C++ Build Tools/Windows SDK, .NET Framework 4.8 and its in-box C# compiler, Python 3 (`py`), and `py -3 -m pip install fonttools brotli` to convert the bundled Inter font. The build machine needs WebView2 for the smoke test. Tauri fetches NSIS and the WebView2 bootstrapper on first bundle; a machine without WebView2 needs internet access during installation.

Windows uses `Husarp/linebreaker`'s stable `/releases/latest/download/latest.json` and the matching release-page opener scope. The Android `channel` and `shell-channel` prereleases are separate. Windows does not apply web bundles, so shell API, OTA trial/rollback and reset to built-in are not applicable. To diagnose updates, long-press the version in Settings or Credits and quote the shell version. The screen offers **Check now**, **Restart**, automatic checks, and a timestamped log with speed, Copy and Clear. “What's new ›” appears for one session after upgrading and disappears when a newer update is available.

Use the **existing** Tauri updater signing pair. The public key is already pinned in `src-tauri/tauri.conf.json`. Restore the private key and password from secure storage to an external location with restricted permissions. For example, in PowerShell (do not echo either value):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.keystores\linebreaker\tauri-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -Raw "$env:USERPROFILE\.keystores\linebreaker\tauri-updater.password").TrimEnd("`r", "`n")
```

The release script passes these variables through to Tauri. Alternatively, inject the password from a secret manager and remove both variables from the shell after the build. Do not generate or rotate the updater key for this release. These signatures are for the Tauri updater, not Windows Authenticode.

1. Run `npm ci`, then `npm run desktop:release -- X.Y.Z --notes-file release-notes.md` (notes are optional). This synchronizes the Tauri, Cargo, and npm version files from the supplied version, refreshes `Cargo.lock`, checks tracked files for common release exclusions, and runs `cargo check` and `npm test`. The build rejects version mismatches. Before NSIS bundling, the already-built release app opens its packaged WebView with isolated data and must report the expected version within 30 seconds. To build the current version without staging release assets, use `npm run desktop:build`.
2. Review `git ls-files` for private saves, notes, drafts, logs, test builds, or signing material not covered by the automated exclusions. Review the version and lockfile changes. Tag the intended source as `vX.Y.Z` before publishing.
3. On Windows, verify fresh install (including a machine without WebView2), Update/Cancel with the app running, failure/retry and rollback, and the finish/restart behavior. Check 125% and 150% scaling, F11, upgrade/save preservation, and both uninstall choices. From an older signed build, verify the full in-app update and cleanup. These are Windows release gates, not covered by the Linux `cargo check` or packaged startup smoke test.
4. From `release/windows/X.Y.Z/`, use the script's printed `gh release create` command to publish the versioned Setup.exe, its `.sig`, and `latest.json` in a stable release marked **Latest**. The manifest gives Tauri the exact installer URL, updater signature, and size for `windows-x86_64`. Confirm the public endpoint and recheck the signed update from the older build after publishing.
