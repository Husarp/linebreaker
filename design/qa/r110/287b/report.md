# Ticket 287b — Universal part sources

Golden Zone awarded 221 of the 261 Common universals (one for each weekly point above 180). Eight Bonus Boxes paid the remaining 40 (five each). Crate rolls, Daily Gifts, achievements, level-ups, and migration supplied none of the 261 in this simulation. Rank-up collection did have a separate direct Rare universal grant outside the simulation.

Weekly rewards now stop at the final crate milestone; already-earned Golden Zone claims and balances are preserved. Bonus Boxes now store one Common crate at the same threshold, retaining existing progress. Rank-ups retain crates and boosters, but no longer pay universals directly. Crate drops use the closest eligible pool at or below the roll; exhausted pools convert one drop to one universal at no higher than the crate rarity, subject to the one-per-crate Legendary/Mythic caps. The guaranteed universal table is unchanged. Common crates already randomized one or two item parts; the range is now explicit and both ends are tested.

## Seed 287 — June 2026, before and after

Before: 163 crates, 1,005 SP, track complete on day 27, one Season Pass bonus chest.

| Rarity | Crates | Share | Plan share | Item parts | Universal parts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Common | 94 | 57.7% | 53% | 219 | 261 |
| Rare | 56 | 34.4% | 35% | 109 | 56 |
| Epic | 11 | 6.7% | 10% | 42 | 12 |
| Legendary | 1 | 0.6% | 2% | 7 | 1 |
| Mythic | 1 | 0.6% | 1% | 0 | 1 |

After: 171 crates (eight from Bonus Box), 995 SP, track complete on day 27, one Season Pass bonus chest.

| Rarity | Crates | Share | Plan share | Item parts | Universal parts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Common | 101 | 59.1% | 53% | 230 | 0 |
| Rare | 58 | 33.9% | 35% | 115 | 58 |
| Epic | 10 | 5.8% | 10% | 32 | 11 |
| Legendary | 1 | 0.6% | 2% | 19 | 1 |
| Mythic | 1 | 0.6% | 1% | 0 | 1 |

The after run draws a different random sequence because it opens eight more crates and rerolls unavailable drops. It still falls short of the plan's ~208 crates and does not validate the completion-time projection. The planned Mythic items are not yet in the drop pool.

## Verification

- Changed crate rolls, mission and rank grants, save sanitization, seeded simulation, changelog, and regression tests.
- `npm test -- --maxWorkers=4`: 452 tests passed in 39 files.
- WB-4 QA: `287b-phone-weekly.png`, `287b-phone-crate.png` (390×844 with hole cutout); `287b-desktop-weekly.png`, `287b-desktop-crate.png` (1280×800). Weekly shows three milestones ending at 120 points; the Common crate shows an item part and no universal reward. No console errors; the QA tab was closed.
