# Linebreaker desktop (Tauri 2)

Work in this repository; no dev server is needed. `npm ci`, then `npm run desktop:dev`.
The shared `npm run build:web` step refreshes ignored `dist-web/` from the static game and `desktop.js`.
It includes fonts, music.json and music MP3s only when present locally. MP3s remain ignored;
do not distribute third-party music without permission. The cyan L-mino SVG and generated
icons in `src-tauri/icons/` are placeholders. Regenerate with
`npx tauri icon src-tauri/icon.svg` after replacing the design.

The window starts centered at 1280×800, minimum 960×600; F11 toggles fullscreen.
Desktop saves bypass the browser picker and use the existing serialized save queue.
`save.json` lives in Tauri's app data directory (Windows:
`%APPDATA%\com.husarp.linebreaker`), outside the installation folder.
Writes sync a temporary file then rename it over the save, keeping one `save.bak`.
An unreadable primary falls back to the backup; if both fail, an error is shown and
writes are blocked until restart. Back up this directory before manual recovery.

## Windows prerequisites and build

Install Node.js LTS, Rust stable with the MSVC target, Visual Studio C++ Build Tools
and Windows SDK, and Microsoft Edge WebView2 Runtime. Tauri downloads NSIS when
building the NSIS bundle; network access is needed on the first build. Use the
per-user installer (no elevation). WebView2 bootstrap installation can require
network access on a machine without the runtime.

`src-tauri/tauri.conf.json` is the release version source. Set Cargo.toml's package
version to the same value; the pre-build script rejects a mismatch. Cargo.lock and
package-lock.json lock the resolved stable 2.x tools. Run `npm ci` on Windows.

Generate an updater signing pair **outside the repository**:

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.linebreaker-keys\updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.linebreaker-keys\updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<key password>'
```

Create the key directory first. Keep the private key/password in a secure backup or
CI secrets. Put only the generated public key text into `plugins.updater.pubkey` in
tauri.conf.json. Never commit private signing material. Updater signatures are
separate from optional Windows Authenticode signing.

The repository **https://github.com/Husarp/linebreaker is a PLACEHOLDER**, not a
created release destination. The configured latest.json endpoint is a placeholder
for that planned repository. The conspicuous PLACEHOLDER public key prevents a
release build until replaced. Create/confirm the repository before publishing.

Build on Windows with `npm run desktop:build` (not run as part of this ticket).
The build checks version agreement, signing configuration, copies the frontend,
and runs `npm test` before packaging. It does not prove the packaged app works:
launch the packaged executable and smoke-test it before distributing its installer.
Artifacts are under `src-tauri/target/release/bundle/nsis/`.

## Release procedure

1. Bump the version in tauri.conf.json and match Cargo.toml; regenerate Cargo.lock
   with `cargo check`. Run `npm test` and `cargo check --manifest-path src-tauri/Cargo.toml`.
2. Check `git ls-files`: no private saves, music, signing keys, logs, test installers,
   archives or local design material. Replace the placeholder icon before shipping.
3. Build on Windows, then smoke-test the packaged app and NSIS installer as a normal
   user: fresh install, existing install update, uninstall, WebView2 bootstrap,
   125%/150% scaling, F11 and saves surviving upgrades. Test an update from an older
   signed version; verify download progress, failure/retry, backup recovery and restart.
4. Publish the versioned NSIS file as `LinebreakerSetup-X.Y.Z.exe`, its updater
   signature, and `latest.json` in a stable GitHub release marked Latest. latest.json
   uses `version`, `notes`, `pub_date`, and `platforms.windows-x86_64` containing the
   exact versioned installer `url` and the `.sig` file's contents as `signature`.
   Renaming the installer does not change the signature; update its manifest URL.
   Add other Windows architectures only if built and verified.
5. Test the public latest.json endpoint and the complete older-version update path.
   Never rotate the updater key without planning migration for existing installs.

Desktop updates check on boot and return (five-minute throttle), with an opt-out
and manual checks under Settings → DESKTOP UPDATES. Dismissal hides notifications
until restart. Downloads and signature verification happen in-app; progress includes
size, done/total and speed. GitHub asset metadata supplies size before download when
available. Failures offer TRY AGAIN and GITHUB; no page opens automatically.
Tauri hands the verified NSIS installer off in passive mode and restarts the app.
The updater manages its temporary download outside the repository.

## Installer standards and remaining Windows validation

This shell uses Tauri's supported NSIS install/update/uninstall flow, per-user
installation and passive in-app updates. Stock NSIS is **not** the owner's custom
Handy-style installer: its welcome/update wording, same-exe uninstall entry,
step-level progress, rollback/retry UI and themed pages do not fully implement
APP-STANDARDS section 5. A custom NSIS template and Windows validation are required
before claiming full installer-standard compliance. Do not distribute this shell
as a finished standards-certified installer. The packaged smoke test is likewise a
manual Windows release gate, not an automated host-side packaged-app self-test.
