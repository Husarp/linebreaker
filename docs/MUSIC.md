# Music

The built-in soundtrack consists of ten original synth scores and six [CC0 recordings](MUSIC-CREDITS.md). All are available without unlocking. Default playlists include the new recordings; existing custom playlists keep their selections and can add any new track. The player plays one loop before picking another track, or loops a release recording in place when it's the only eligible track. Synth times below are rounded to the nearest second.

| Playlist | Score | BPM | Loop |
| --- | --- | ---: | ---: |
| Menu | Glass Harbor | 76 | 76 s |
| Menu | Fernlight | 88 | 76 s |
| Menu | Paper Orbits | 82 | 70 s |
| Menu | Blue Hour | 92 | 73 s |
| Game | Copper Relay | 136 | 99 s |
| Game | Vector Bloom | 148 | 104 s |
| Game | Switchyard | 132 | 102 s |
| Game | Tidal Engine | 152 | 101 s |
| Intense | Redline Echo | 172 | 67 s |
| Intense | Fault Current | 184 | 73 s |

Menu tracks shuffle without immediate repeats. Below speed level 5, gameplay draws from the Game and Intense playlists, with a 38% chance of using Intense when both are enabled. At level 5 and above, enabled Intense tracks take priority; a regular synth track finishes its bar before switching. Older saved playlists that reference only unavailable tracks fall back to the built-in selections.

**Music follows speed** is on by default. Synth tracks start at normal tempo in menus and at the start of a run, then add 4% per level above speed 1, capped at 50%. Changes take effect at bar boundaries without changing pitch. Turning the option off during a run holds the current tempo target until the run ends or the option is turned back on. Recorded tracks keep their original tempo.

## Define a score

- Add a score ID to `music-synth.js`. Set `bpm`, `swing` (the fraction of a sixteenth note by which odd steps are delayed), `feel` (`calm`, `drive`, or `rush`), the three `waves` (lead, bass, arp), the low-pass `cutoff` in Hz, and the mix `trim`.
- Each letter in `form` plays a four-bar section in 4/4. `A`, `B`, and `C` refer to the corresponding entries in `chords` and `lead`; lowercase plays a thinner arrangement. Each section has four chords, in `root:quality` notation (for example `D3:m9`), and four lead bars.
- In a lead bar, write space-separated `step:note:length` events (for example `2:E5:5`). Steps are zero-based sixteenths (`0`–`15`); length is in sixteenths. Empty parts of a bar are rests. Bass and arpeggios follow the chords; the feel supplies their rhythms and the drum patterns.
- Add `{ "synth": "score-id", "title": "Track Title", "tags": [...] }` to `menu`, `game`, or `intense` in `assets/music.release.json`. Keep titles unique because saved playlists identify tracks by title. An optional `artist` appears in the player.

The synth uses amplitude envelopes, waveform compensation, and per-score trim for a consistent mix. Kick uses a pitch sweep; snare and hats share a filtered noise buffer. A timer schedules a short window against `AudioContext.currentTime`; playback is independent of rendering frames and stops scheduling when paused or stopped.

Menu and gameplay share one music player. It releases the old source before starting the next one, pauses in the background, and retries blocked audio on a user interaction. If a recording fails to load or play, the player logs the failure and falls back to a built-in score. The playlist uses blue checks for Menu, green checks for Game (including Intense), and a pixel equalizer that stays still when music is paused, muted, or reduced motion is enabled.

When the page is hidden or the native app pauses, recorded and synthesized music pause, and sound effects are discarded rather than replayed on return. Achievements still unlock and remain claimable, but their background sounds and popups are skipped.

## Build or add recorded audio

`npm run build:web` stages `assets/music.release.json` as `dist-web/assets/music.json` and copies only the listed CC0 recordings from `assets/music-release/`. APK, OTA and desktop release packaging use the same default build. Release recordings use 64 kbps stereo Opus and are level-matched by playlist, with source loop points preserved apart from short silence trims and de-click fades.

To preview audio you own or have permission to use, encode it with `ffmpeg -i input.mp3 -map 0:a:0 -map_metadata -1 -c:a libopus -b:a 64k -vbr off -ac 2 output.ogg`. Keep source MP3s under `.local/music-mp3/`. Place the Ogg Opus recording in `assets/music/` and add its exact filename as `file` in the appropriate section of `assets/music.json`, with a unique `title` and optional `artist` and `tags`. Match its perceived volume to the synth before adding it. When serving the source tree, both catalogues are used. For a private staging build, run `npm run build:web -- --local-music`; only locally present, catalogued `.ogg` files are added to the release soundtrack. Do not distribute that build with private recordings.
