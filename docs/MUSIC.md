# Music

The built-in soundtrack consists of ten original synth scores. Each score makes one complete loop before the player picks another track. Times below are rounded to the nearest second.

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

Menu tracks shuffle without immediate repeats. Gameplay draws from the Game and Intense playlists, with a 38% chance of using Intense when both are enabled. Older saved playlists that reference only unavailable tracks fall back to the built-in selections.

## Define a score

- Add a score ID to `music-synth.js`. Set `bpm`, `swing` (the fraction of a sixteenth note by which odd steps are delayed), `feel` (`calm`, `drive`, or `rush`), the three `waves` (lead, bass, arp), the low-pass `cutoff` in Hz, and the mix `trim`.
- Each letter in `form` plays a four-bar section in 4/4. `A`, `B`, and `C` refer to the corresponding entries in `chords` and `lead`; lowercase plays a thinner arrangement. Each section has four chords, in `root:quality` notation (for example `D3:m9`), and four lead bars.
- In a lead bar, write space-separated `step:note:length` events (for example `2:E5:5`). Steps are zero-based sixteenths (`0`–`15`); length is in sixteenths. Empty parts of a bar are rests. Bass and arpeggios follow the chords; the feel supplies their rhythms and the drum patterns.
- Add `{ "synth": "score-id", "title": "Track Title", "tags": [...] }` to `menu`, `game`, or `intense` in `assets/music.release.json`. Keep titles unique because saved playlists identify tracks by title. An optional `artist` appears in the player.

The synth uses amplitude envelopes, waveform compensation, and per-score trim for a consistent mix. Kick uses a pitch sweep; snare and hats share a filtered noise buffer. A timer schedules a short window against `AudioContext.currentTime`; playback is independent of rendering frames and stops scheduling when paused or stopped.

## Build or add recorded audio

`npm run build:web` is release-safe by default. It stages `assets/music.release.json` as `dist-web/assets/music.json` and never copies MP3s. Android and desktop use the same default build.

To preview audio you own or have permission to use, place an MP3 in `assets/music/` and add its exact filename as `file` in the appropriate section of `assets/music.json`, with a unique `title` and optional `artist` and `tags`. Match its perceived volume to the synth before adding it. When serving the source tree, both catalogues are used. For a private staging build, run `npm run build:web -- --local-music`; only locally present, listed MP3s are staged alongside the original scores. Do not distribute that build with the old commercial tracks. Shipping licensed recordings later requires deliberately updating the release packaging policy.
