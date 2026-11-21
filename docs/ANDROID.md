# Android shell — Linebreaker

The Android-only Capacitor 8 shell uses app ID com.husarp.linebreaker.
It packages static files locally, locks the activity to portrait, hides system
bars (swipe reveals them temporarily), and keeps the screen awake while the
activity is visible. Hardware Back closes an overlay using the game's existing
controls, pauses gameplay, and asks before exiting the main menu. Backgrounding
also pauses gameplay. App is wired for navigation/lifecycle; Haptics and Filesystem are wired for gameplay and saves; Preferences remains unused.

The cyan T mino launcher icons and splash images are **placeholders**, manually
generated in android/app/src/main/res. Replace them before release.

## Development

Run `npm ci`, then `npm run android:sync` to build the web bundle, generate Capacitor configuration, sync native plugins, and prepare the built-in manifest and public key. `npm run android:open` opens Android Studio. `npm run build:web` recreates `dist-web/` from
the game, desktop/native adapters, touch.js/css, ui/tokens.css, all bundled fonts
(including Inter), and the original synth soundtrack, not local MP3s. Both Capacitor
and Tauri use this single build:web output. See [Music](MUSIC.md) for audio packaging.

Set ANDROID_HOME=/home/coder/android-sdk here, or set sdk.dir in the ignored
android/local.properties. Keep local paths, build outputs and signing keys out
of Git. The generated Gradle wrapper uses Gradle 8.14.3 with AGP 8.13.0;
Capacitor 8 targets SDK 36. The OTA shell minimum is **Android 8 / API 26** for the reference Java APIs; API 24–25 are not verified or supported by this port. Confirm that floor before release. JDK 21 is installed at
`~/.local/jdk/jdk-21.0.13+9`; Java 25 fails with Unsupported class file major
version 69. Verify with `npm test` and `./android/gradlew -p android --no-daemon --max-workers=2 :core:test :app:compileDebugKotlin` after syncing. These checks do not package an APK or use release passwords.

## Playable input and storage

Touch/coarse-pointer devices and native Capacitor show 48px button controls during
play. Drag the board sideways to move by cells; tap to rotate clockwise, tap the
left third or tap with two fingers for counter-clockwise using the same kick logic
as keyboard rotation. Fast downward swipes hard-drop; slow downward drags soft-drop;
swipe up to hold (when enabled by the mode). Buttons also offer hold and pause,
with held movement using the keyboard DAS/ARR path. Board gestures suppress page
scroll/zoom. The first pointer interaction unlocks audio. Native lock/clear events
use @capacitor/haptics; verify feel and gesture thresholds on a physical phone.

Android uses @capacitor/filesystem Directory.Data with UTF-8 save.json, save.bak
and a temporary save.tmp promoted by rename. It shares the desktop native-save
contract and serialized game write queue and bypasses the file picker. An invalid
primary recovers from backup; an unreadable save blocks writes until restart.
Storage survives app upgrades with the same app ID; uninstall clears app data.
Backup/restore and device persistence still need physical-device verification.

## Mission reminders

Settings → Reminders is Android-only and off by default. Its switches control
daily mission refresh at local midnight, weekly refresh at Monday midnight,
and a same-day 8 p.m. streak reminder when the daily gameplay XP goal is unmet.
Linebreaker requests notification permission once from a settings toggle. If
denied, enable it in Android Settings. Android can delay delivery when exact
alarms aren't allowed; the app doesn't prompt for exact-alarm access.

## Still required for a playable phone version

- Portrait layouts for every screen, overlay and keyboard/safe-area situation.
- Device backup/restore and update-persistence checks; existing WebView IndexedDB
  saves are not automatically migrated.
- Device lifecycle/audio-focus validation.
- A measured performance budget on a representative low-end phone: frame time,
  input latency, memory, battery and audio loading.
- Device verification of Back ordering, portrait lock, system-bar gestures,
  suspend/resume and screen-awake behavior. This shell is not device-validated.

## Android Updates

The first public APK already includes OTA; there is no legacy updater transition. `ota.config.json` is authoritative for Android identity, versions, paths, and the fixed `Husarp/linebreaker` GitHub channels:

- `channel/manifest.json`: signed web inventory and content-addressed changed files. Verified overlays leave the Capacitor HTTPS localhost origin and game saves untouched.
- `shell-channel/shell.json`: signed metadata for a versioned APK. Android also verifies the same installed package/certificate and a higher `versionCode` before installing.
- Normal `vX.Y.Z` releases remain the fallback for fresh installs and recovery. Neither channel becomes GitHub **Latest** or replaces Windows `latest.json`.

Settings → Android updates includes manual check, GitHub fallback and update policy. Recommended policy checks every six hours, auto-downloads small fixes and shell updates, asks for big fixes/features, and caps automatic downloads at 20 MiB on Wi-Fi and 5 MiB on mobile. Metered Wi-Fi counts as mobile. Manual mode disables automatic checks, including critical discovery. Android background work is best effort; lock, Doze, or force-stop can delay it. Neither a WebView restart nor an APK install should interrupt a live/paused run or a pending save. The app may need its own **Install unknown apps** permission and OS confirmation; silent installation is not guaranteed. Update notification permission is optional and independent of game reminders.

Long-press the version in Settings or Credits for diagnostics. Quote the **shell version, web version and shell API** in reports. Use **Check now**, **Restart**, the timestamped log (Copy/Clear), and the automatic-check switch. **Reset to built-in version** removes only downloaded web updates, reopens update setup and keeps the save. Startup recovery can roll back a trial offline. “What's new ›” only appears in the first session after an update; a newer offer replaces it.

The native game defers writing during trial startup until the bundle is accepted. Android keeps a versioned backup before upgrading an older save schema; a newer save or failed backup opens read-only. Keep future trial migrations additive. Android backup/device transfer excludes updater overlays and installer state, not saves.

## Release Preparation

Use the **existing** `~/.keystores/linebreaker/release.jks` (alias `linebreaker`) and `ota-private.pem`. Never generate or replace them. Gradle reads the external `signing.properties` only for a release build (`storePassword`, `keyPassword`), or uses `LINEBREAKER_ANDROID_STORE_PASSWORD` and `LINEBREAKER_ANDROID_KEY_PASSWORD` supplied by a secret manager. Never put either password or private key in the checkout, release assets, or logs. Only `keys/public-key.b64` is packaged. Confirm the first release code exceeds any privately distributed same-ID, same-certificate builds.

1. Before the first signed build, run `npm run android:release:audit`, then `npm run android:ota:freeze-baseline`. Archive the exact frozen `.local/ota-baseline/0.1.0` externally. Do not regenerate it after distributing the APK. Restore all supported APK web archives before signing future bundles; this includes any built-in web version introduced by a newer shell. An already archived version is immutable; advance `build.webVersion` to embed different bytes.
2. Set independent APK `build.versionCode` (strictly increasing), `build.versionName`, `build.webVersion`, `shellApi` and `minShellApi` in `ota.config.json`. Bump `shellApi` for new required native functionality; keep the bridge additive and `minShellApi` no higher than the embedding shell. Run `npm run android:release` only when ready to produce an APK. Verify the certificate with the SDK's `apksigner verify --print-certs`. The standalone output is `android/app/build/releases/Linebreaker-X.Y.Z.apk`; matching shell inputs are staged in `dist/apk/`.
3. Prepare a signed shell channel set with `npm run android:ota:shell -- <versionCode>`. For a web-only release, use `npm run android:ota:bundle -- X.Y.Z --kind fix --message "Release notes"` (or `--kind feature`; optional `--min-shell N` and `--block X.Y.Z,...`). This writes a signed manifest and payloads under `dist/`, not an APK. Never publish intentionally broken acceptance fixtures to these channels.
4. Only after device acceptance, publish the standalone versioned APK in the stable release and explicitly publish prepared OTA assets with `npm run android:ota:publish -- bundle X.Y.Z` or `npm run android:ota:publish -- shell <versionCode>`. The publisher uploads payloads before replacing signed metadata and keeps older payloads for in-flight downloads. Preserve both platforms' fallback assets and Windows `latest.json` on stable Latest. Allow for GitHub propagation delays.

**Physical-phone gate:** Verify fresh signed install and same-certificate shell upgrade; routing/origin, restored saves, and play/paused/save interruption guards; setup, manual/automatic schedules, Doze/lock/metered limits; signed delta transfer, resume, invalid hash/signature, offline and low storage; trial timeout/Wait/two-failure recovery, stale token rejection, signed blocking and reset with untouched saves; min-shell waiting and overlays across APK upgrades (including removed/reverted files); unknown-app denial/grant, OS confirmation cancel/retry, process death, notification opt-out, and one-session notes. Test the hidden screen and fullscreen/safe-area behavior on the phone.

This is a sideload build, **not** a Google Play build. A Play variant must exclude self-install permissions and updater behavior and use Play-managed updates.
