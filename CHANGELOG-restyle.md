
## R0 — design book update

- Recorded protected menu buttons, rank/XP displays, missions, HUD and configurable background, with explicit font exceptions.
- Added rounded-rectangle button, rectangular 5% slider, opt-in patterned progress and pause icon-row rules/tokens.
- Replaced gallery HUD with the current index.html structure (prefixed IDs, no handlers, static canvas samples); added pause icon controls and rendered inventory skin previews with ownership and parts states.
- Validation: node --check app.js; npm test (52 passed); gallery IDs/range steps/script syntax; local HTTP serve + curl for gallery/CSS; git diff --check. No tests changed, no production game files changed, no commits. Server stopped.

## R1 — game foundations

- Linked local Inter and shared tokens before game CSS; guarded gallery defaults from the game so protected menu, rank/XP, missions and HUD styles retain their existing rules.
- Consolidated nine fullscreen shells into one solid-background class; retained missions overflow/alignment and credits alignment.
- Styled alert/confirm panels and actions, shared non-mission tooltips and achievement toasts with solid surfaces and Inter/Orbitron; added dialog names and toast status semantics.
- Replaced hidden slider facades with rectangular native controls and visible keyboard focus/44px targets, retaining IDs, handlers and existing value displays. Percentage controls use 5% steps (grid changed from 10); timing/discrete/count controls retain their compatible units and steps. No saved-value migration.
- Wired --accent to the existing --primary theme property, including custom colours, without changing background/theme behavior. Included tokens.css in web packaging.
- Validation: node --check app.js; npm test (52 passed); npm run build:web; protected menu/missions content and existing IDs checked; nine screen shells and percentage steps checked; local python HTTP serve + curl for page/tokens/Inter, server stopped; git diff --check. No test changes, skills or commits. Browser visual verification was not performed.

## R2 — run and reward overlays

- Replaced stacked pause actions with one large Resume and one accessible SVG icon row for Restart, Main menu via run results, and Settings. Reused existing handlers; leaving retains the existing end-run confirmation/results flow and restart starts a fresh run.
- Scoped rounded rectangular 44px actions, solid surfaces, Inter/Orbitron typography, readable result rows, responsive reward cards and written rarity states to pause/game-over/level-up/rank-box/level-milestone/mission-milestone reward overlays. Preserved rank identity colours and fonts, reward calculations, save format and claim/open handlers.
- Restyled the existing start sequence with a centred solid surface and short transform/opacity entrance, keeping its existing duration and gameplay start timing. Removed claim pulse animations in these overlays and honoured reduced motion.
- HUD consistency only: solid existing panels and consistent label/counter fonts; preserved HUD markup and geometry. Protected menu, rank/XP and missions screen markup unchanged; mission milestone popup styling is isolated from the missions screen.
- Validation: node --check app.js; npm test (52 passed); protected menu/missions/HUD markup equality, all original IDs retained, unique IDs and named pause controls; temporary python HTTP server + curl for page/CSS/script/tokens, server stopped; git diff --check. No tests changed, browser visual verification, skills or commits.

## R3 — collection and utility screens

- Added scoped solid panels, centred columns, Inter/Orbitron typography, rounded rectangular 44px actions, visible focus/selection, responsive layouts and transform/opacity-only transitions to inventory, settings, playlist, achievements, stats/leaderboard, rules, credits, transfer, file setup, tutorial, daily gift and the light dev panel.
- Inventory now has persistent canvas skin previews rendered with the game renderer, palette block samples, theme colour samples, explicit Equipped/Owned/Locked labels and labelled patterned parts progress. Existing equip/unlock handlers, costs and saved values remain intact.
- Restyled theme colour picker and palette viewing/editing/custom controls; added accessible input/close names and keyboard-operable colour presets. Playlist membership controls are named native buttons with pressed state and 44px targets.
- Added docs/MISSIONS-TOUCHUPS.md with five small before/after proposals only; no missions screen implementation changes.
- Validation: node --check app.js; npm test (52 passed); all original static IDs retained and unique; protected menu outside dev panel and missions markup equality; local Python HTTP server + curl for page/CSS/script/tokens/proposal, server stopped; git diff --check. Tests unchanged. No browser visual verification, skills or commits.
