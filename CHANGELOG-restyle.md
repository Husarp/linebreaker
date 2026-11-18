
## R0 — design book update

- Recorded protected menu buttons, rank/XP displays, missions, HUD and configurable background, with explicit font exceptions.
- Added rounded-rectangle button, rectangular 5% slider, opt-in patterned progress and pause icon-row rules/tokens.
- Replaced gallery HUD with the current index.html structure (prefixed IDs, no handlers, static canvas samples); added pause icon controls and rendered inventory skin previews with ownership and parts states.
- Validation: node --check app.js; npm test (52 passed); gallery IDs/range steps/script syntax; local HTTP serve + curl for gallery/CSS; git diff --check. No tests changed, no production game files changed, no commits. Server stopped.
