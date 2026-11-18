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

Run npm install, then npm run android:sync (build:web followed by cap sync android).
npm run android:open opens Android Studio. build:web recreates dist-web/ from
the game, desktop/native adapters, touch.js/css, ui/tokens.css, all bundled fonts
(including Inter), and the original synth soundtrack, not local MP3s. Both Capacitor
and Tauri use this single build:web output. See [Music](MUSIC.md) for audio packaging.

Set ANDROID_HOME=/home/coder/android-sdk here, or set sdk.dir in the ignored
android/local.properties. Keep local paths, build outputs and signing keys out
of Git. The generated Gradle wrapper uses Gradle 8.14.3 with AGP 8.13.0;
Capacitor 8 targets SDK 36. JDK 21 is installed at
`~/.local/jdk/jdk-21.0.13+9`; Java 25 fails with Unsupported class file major
version 69. Verify with `npm run android:sync`, `npm test`, and in android/:
`JAVA_HOME=~/.local/jdk/jdk-21.0.13+9 ./gradlew help`. No APK is produced.

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

## GitHub Sideload Release

Follow `/home/coder/code/projects/APP-STANDARDS.md`, sections 2–4. Set the
release version in `src-tauri/tauri.conf.json`; Gradle uses that value for
`versionName` and derives `versionCode = major * 1,000,000 + minor * 1,000 + patch`.
Use a stable `X.Y.Z` with minor and patch below 1000. The code must exceed the
previously distributed APK's code. If releasing desktop too, follow its version
sync steps in `docs/DESKTOP.md`.

Install JDK 21 and configure the SDK as described under Development. Set:

| Environment variable | Value |
| --- | --- |
| `LINEBREAKER_RELEASE_REPO` | Actual public GitHub `owner/repo` (required for release; no placeholder is used). |
| `LINEBREAKER_ANDROID_KEYSTORE` | Absolute path to the release keystore; defaults to `~/.android-keys/linebreaker.jks`. |
| `LINEBREAKER_ANDROID_KEY_ALIAS` | Existing release key alias. |
| `LINEBREAKER_ANDROID_STORE_PASSWORD` | Keystore password. |
| `LINEBREAKER_ANDROID_KEY_PASSWORD` | Key password. |

Supply passwords via your environment/secret manager, not files or command-line
arguments in the checkout. Keep the key and its backup outside Git, and use the
same signing key for every update. A debug-signed install cannot be upgraded
with the release APK. Gradle release builds fail if signing configuration is
missing or the resolved keystore is inside the checkout. Debug builds and
`./gradlew help` need no release secrets; without `LINEBREAKER_RELEASE_REPO`,
debug builds do not contact GitHub.

1. Run `npm run android:release:audit` and review `git ls-files` for private
   notes, builds, logs, test data, or unlicensed assets. The audit runs without
   generating an APK. Complete the launcher asset and device checks above.
2. When ready to make an APK, run `npm run android:release`. It audits tracked
   files, runs tests, syncs without locally present music, builds the signed
   release, and puts `Linebreaker-X.Y.Z.apk` in `android/app/build/releases/`.
   Use the SDK's `apksigner verify --print-certs` to confirm the expected signer.
3. Create a stable GitHub release tagged `vX.Y.Z` (or `X.Y.Z`), with a neutral
   patch-release title. Upload the versioned APK and mark the release **Latest**.
   Keep exactly one Android APK on the Latest release, including when carrying
   desktop assets; the updater selects by `.apk` suffix, not a fixed filename.
   Publishing and tagging are manual.
4. On a phone with an older release signed by the same key, confirm the banner,
   save retention, download size/speed, first-time permission and automatic
   handoff on return, Android's confirmation, launch after upgrade, and cache
   cleanup. Also test denied permission, canceled install, offline check, and
   retry. These device checks are not covered by `gradlew help` or the JS suite.

The app checks GitHub at launch and on return, at most once per five minutes
including manual checks. The menu banner stays dismissed until a fresh start.
Settings shows the current version, automatic-check switch, CHECK NOW, GITHUB,
and GET UPDATE when available. Automatic failures stay silent; a manual check
times out after about ten seconds. The app downloads the APK over HTTPS into
its private cache, reports progress and speed, and launches Android's installer
after any required permission grant. Android still asks the user to confirm.
On failure, TRY AGAIN and GITHUB are offered without opening the browser.
The next installed version removes the old APK from the update cache.

This is a sideload build, **not** a Google Play build. Before creating a Play
variant, exclude `REQUEST_INSTALL_PACKAGES`, the updater plugin and UI, and use
Play-managed updates, signing, listing, and release testing.
