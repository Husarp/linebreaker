
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
