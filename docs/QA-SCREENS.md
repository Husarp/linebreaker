# QA demo screens

Open `index.html?dev&demo` from the web server. Both query flags are required. The game skips save setup and uses an in-memory profile; changes are discarded on reload. Import and export are disabled in this mode.

At 390×844, add `&cutout=hole` or `&cutout=notch` to simulate native cutout rectangles, or `&cutout` for a centered punch hole with only a 40px CSS safe-area inset. The Circuit trace should stay below the camera and above all app controls. Without a top inset (standard desktop browser), the band should collapse. Switch accents in Settings → Display to check Cyan and Green independently of wallpaper.

```js
await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
const names = await page.evaluate(() => window.__LB_QA.list());
await page.evaluate(() => window.__LB_QA.open('settings'));
```

`open(name)` closes the previous QA target and prepares the next. Run targets wait for the half-second logo flash to finish, except `start-animation`, which returns while the flash is playing. Capture that target immediately. For other screens, allow entrance animations and images to settle. Reload to restore the initial fixture after claiming rewards or resetting progress.

| Area | Screen names |
| --- | --- |
| Main menu and play | `menu`, `play`, `play-fun` |
| In-game | `start-animation`, `game`, `pause`, `game-over` |
| Settings and dialogs | `settings-home` (category menu), `settings` (Game), `settings-controls`, `settings-audio`, `settings-display`, `settings-notifications`, `settings-updates`, `settings-about`, `whats-new-notice`, `transfer`, `reset-progress`, `color-picker`, `sfx-preview`, `sfx-panel` |
| Inventory and dialogs | `inventory`, `inventory-colors`, `inventory-other`, `palette-preview`, `palette-editor`, `custom-palette`, `inventory-sfx`, `universal-parts`, `universal-exchange`, `booster-exchange` |
| Stats and scores | `stats`, `leaderboard`, `pinned`, `highscores` |
| Progression | `missions`, `missions-weekly`, `mission-confirm`, `season-pass`, `achievements`, `level-up` |
| Crates | `daily-gift`, `level-crate`, `mission-crate` |
| Music and help | `playlist`, `help`, `tutorial`, `credits` |
| Generic dialogs | `alert`, `confirm` |

The fixture uses late Gold (level 30), one level below the final modifier unlocks, so Play shows both locked and unlocked options. Music uses the game’s enabled playlists; there is no separate track purchase system. `season-pass` opens the dedicated Season Pass screen. The season follows the real calendar, so on its first day there is only one unlocked stage and no prior claim. Save setup and platform update dialogs are not screenshot targets.

Before staging a release, serve the repository root and open `index.html?dev&demo` in an owned work tab. Run `tests/qa-browser.mcp.js` as the Playwright MCP `browser_run_code_unsafe` callback (load the file or pass its contents as `code`). The sweep opens every target at 390×844 and checks browser errors, band clearance, Daily Gift, and Mission Claim. Pass `viewport`, `cutout` (`'hole'`, `'notch'`, or `''` for the fallback), and `accent` (`'dark'` for Cyan or `'green'`) to check the variants. Only 404s for local-only tracks are ignored. Allow at least 90 seconds for each sweep.
