# QA demo screens

Open `index.html?dev&demo` from the web server. Both query flags are required. The game skips save setup and uses an in-memory profile; changes are discarded on reload. Import and export are disabled in this mode.

At 390×844, add `&cutout=hole` or `&cutout=notch` to simulate native cutout rectangles, or `&cutout` for the 40px CSS safe-area fallback. The solid, empty Ledger band should cover the inset without overlapping app controls. On an Android device, check that the real status bar remains visible. Without a top inset (standard desktop browser), the band should collapse. Switch Dark, Light, and System in Settings → Display without changing the wallpaper.

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
| Settings and dialogs | `settings-home` (category menu), `settings` (Game), `settings-controls`, `settings-audio`, `settings-display`, `settings-notifications`, `settings-updates`, `settings-about`, `whats-new-notice`, `update-postcard`, `transfer`, `reset-progress`, `color-picker`, `sfx-preview`, `sfx-panel` |
| Inventory and dialogs | `inventory` (Crates), `inventory-blocks`, `inventory-colors`, `inventory-boosters`, `inventory-parts`, `inventory-other` (SFX Packs), `palette-preview`, `palette-editor`, `custom-palette`, `inventory-sfx`, `universal-parts`, `universal-exchange`, `booster-exchange` |
| Stats and scores | `stats`, `leaderboard`, `pinned`, `highscores` |
| Progression | `missions`, `missions-weekly`, `mission-confirm`, `season-pass`, `achievements`, `level-up` |
| Crates | `daily-gift` (tap Shake crate three times), `level-crate` (Inventory reveal), `mission-crate` (immediate reveal) |
| Music and help | `playlist`, `help`, `tutorial`, `credits` |
| Generic dialogs | `alert`, `confirm` |

Season Pass integration: call `LBCrates.grantCrate(saveData, rarity)` with a lowercase rarity, then persist the crate and the claim receipt together with the caller's normal save. The grant does not open or pay out a crate.

The fixture uses late Gold (level 30), one level below the final modifier unlocks, so Play shows both locked and unlocked options. Music uses the game’s enabled playlists; there is no separate track purchase system. `season-pass` opens the dedicated Season Pass screen. The season follows the real calendar, so on its first day there is only one unlocked stage and no prior claim. Save setup and platform update dialogs are not screenshot targets.

Before staging a release, serve the app and open `index.html?dev&demo` in an owned work tab. Run `tests/qa-browser.mcp.js` as the Playwright MCP `browser_run_code_unsafe` callback (load the file or pass its contents as `code`). The sweep checks every target for browser errors, band clearance, single-line labels, and mid-word breaks, and exercises Daily Gift and Mission Claim. Run at 320×844 and 390×844 with `cutout: 'hole'` to verify the full Achievements menu label, and at 1280×800 without a cutout. Pass `viewport`, `cutout` (`'hole'`, `'notch'`, or `''` for the fallback), and `theme` (`'dark'`, `'light'`, or `'system'`) to check the variants. For System mode, exercise both browser colour-scheme preferences. Only 404s for local-only tracks are ignored. Allow at least 90 seconds for each sweep.
