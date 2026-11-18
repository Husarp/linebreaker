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

## Release and updates

Follow /home/coder/code/projects/APP-STANDARDS.md, especially sections 2–4.
Release/update infrastructure is not implemented by this shell ticket.

Use one canonical version and derive an increasing Android versionCode. Keep
signing keys outside the repository and preserve the same signing identity for
updates. Audit git ls-files before release; exclude builds, private data and
unlicensed audio. Publish stable GitHub releases marked Latest with versioned
artifact names (for example Linebreaker-1.2.3.apk).

A sideload distribution must check GitHub releases at launch and on return,
throttled to five minutes, comparing numeric versions. Provide the dismissible
main-menu banner (dismissal lasts until a fresh start), Settings update toggle
(default on), current version, CHECK NOW, GITHUB and GET UPDATE. Automatic
failures stay silent; manual checks time out around ten seconds with useful
messages. Downloads must show total size, percent, done/total and speed, use the
app's own connection/cache, and hand off to Android's installer. That future
sideload implementation needs REQUEST_INSTALL_PACKAGES and the one-time
unknown-apps settings flow that resumes installation automatically on return.
Delete cached installers after updating; failures offer TRY AGAIN and GITHUB
without automatically opening a browser.

A Google Play build must omit the APK installer/updater permission and flow,
use Play-managed updates, and complete Play signing, listing, policy/data-safety
and release testing before publication. Do not add sideload install permission
to this base shell.
