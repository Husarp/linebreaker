# Android shell — Linebreaker

The Android-only Capacitor 8 shell uses app ID com.husarp.linebreaker.
It packages static files locally, locks the activity to portrait, hides system
bars (swipe reveals them temporarily), and keeps the screen awake while the
activity is visible. Hardware Back closes an overlay using the game's existing
controls, pauses gameplay, and asks before exiting the main menu. Backgrounding
also pauses gameplay. App is wired for navigation/lifecycle; Haptics, Filesystem
and Preferences are installed but otherwise unwired.

The cyan T mino launcher icons and splash images are **placeholders**, manually
generated in android/app/src/main/res. Replace them before release.

## Development

Run npm install, then npm run android:sync (build:web followed by cap sync android).
npm run android:open opens Android Studio. build:web recreates dist-web/ from
index.html, app.js, style.css, assets/fonts and assets/music.json, plus local
assets/music/*.mp3 only when present. Missing licensed audio is not downloaded.

Set ANDROID_HOME=/home/coder/android-sdk here, or set sdk.dir in the ignored
android/local.properties. Keep local paths, build outputs and signing keys out
of Git. The generated Gradle wrapper uses Gradle 8.14.3 with AGP 8.13.0;
Capacitor 8 targets SDK 36 and requires JDK 21 or newer. Java 25 is installed
in this workspace. The Gradle help check fails on Java 25 with
Unsupported class file major version 69; JDK 21 is required here and is not
installed. Rerun the check with JAVA_HOME pointing to JDK 21.
Verify with npx cap sync android, cd android && ./gradlew help, and npm test.
No APK or bundle is produced by these checks.

## Still required for a playable phone version

- Touch controls, including movement, rotate, drop, hold and pause.
- Portrait layouts for every screen, overlay and keyboard/safe-area situation.
- Native save storage through a Filesystem/Preferences adapter, with migration,
  backup/restore and update-persistence checks.
- Audio unlock on the first tap, plus device lifecycle/audio-focus validation.
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
