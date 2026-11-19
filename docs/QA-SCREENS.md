# QA demo screens

Open `index.html?dev&demo` from the web server. Both query flags are required. The game skips save setup and uses an in-memory profile; changes are discarded on reload. Import and export are disabled in this mode.

```js
await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
const names = await page.evaluate(() => window.__LB_QA.list());
await page.evaluate(() => window.__LB_QA.open('settings'));
```

`open(name)` closes the previous QA target and prepares the next. Run targets wait for the real intro to finish before returning, except `start-animation`, which opens the timed intro itself. Allow any screen entrance animation and image loading to settle before capturing. Reload to restore the initial fixture after claiming rewards or resetting progress.

| Area | Screen names |
| --- | --- |
| Main menu and play | `menu`, `play`, `play-fun` |
| In-game | `start-animation`, `game`, `pause`, `game-over` |
| Settings and dialogs | `settings`, `transfer`, `reset-progress`, `color-picker`, `sfx-preview`, `sfx-panel` |
| Inventory and dialogs | `inventory`, `inventory-colors`, `inventory-other`, `palette-preview`, `palette-editor`, `custom-palette`, `inventory-sfx`, `universal-parts`, `universal-exchange`, `booster-exchange` |
| Stats and scores | `stats`, `leaderboard`, `pinned`, `highscores` |
| Progression | `missions`, `missions-weekly`, `mission-confirm`, `season-pass`, `achievements`, `level-up` |
| Crates | `daily-gift`, `level-crate`, `mission-crate` |
| Music and help | `playlist`, `help`, `tutorial`, `credits` |
| Generic dialogs | `alert`, `confirm` |

The fixture uses late Gold (level 30), one level below the final modifier unlocks, so Play shows both locked and unlocked options. Music uses the game’s enabled playlists; there is no separate track purchase system. The season follows the real calendar, so on its first day there is only one unlocked stage and no prior claim. Save setup and platform update dialogs are not screenshot targets.
