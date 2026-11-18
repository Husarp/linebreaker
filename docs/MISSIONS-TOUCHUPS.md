# Missions finishing touches — proposal only

These are small candidates for owner review against the current screen; none is applied in R3. Keep mission cards, tier colours, rank identities, XP and mission step bars unchanged.

- **Header alignment.** Before: the Daily/Weekly tabs are absolutely centred while Back and the other header content occupy the same row. After: reserve explicit side space around the centred tabs at narrow widths, avoiding a collision with Back or a long label.
- **Card spacing.** Before: `.mq-card-hdr`, `.mq-card-body` and the card footer use slightly different gaps (6/9/10px). After: use a consistent 8px internal rhythm and align action baselines within each card row, retaining the existing card size and layout.
- **Secondary-copy contrast.** Before: `.mq-card-desc` uses #888 at a small size, while secret hints and empty messages use #444/#333. After: modestly lighten these secondary labels on the existing background so hints remain readable; retain tier colours and hierarchy.
- **Milestone label alignment.** Before: `.mq-pb-label-item` centres each label using a translated absolute position, potentially crowding the first and last labels against an edge. After: inset only the end labels and give the row a little more vertical breathing room, keeping all step positions and fills intact.
- **Streak metadata spacing.** Before: the streak value, unit and caption use separate gaps and letter spacing. After: align their baselines and use a consistent small gap so the caption reads as part of the same group.

Acceptance: compare before/after at phone and desktop widths, with long mission text and completed/claimed states. These proposals require a separate implementation request.
