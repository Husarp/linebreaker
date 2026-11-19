# Linebreaker design book v3 — Block-Built

Direction B from `design/style-samples/` is the standard for new screen work. Keep each screen’s layout and hierarchy unless its ticket says otherwise. Use solid charcoal surfaces, inset highlights, chunky edges and short, readable text groups instead of plain-text walls.

## Tokens

Use `ui/tokens.css` for `--bb-page`, `--bb-panel`, `--bb-heading`, `--bb-well`, and the consistent `--bb-edge`. The active theme supplies `--accent` and `--accent-bright`; use them for titles, focus and active controls, not full panels. `--bb-danger` is for destructive actions. Rarity frames use `--bb-rarity-*`, including reddish mythic; always pair rarity with a label. The existing background choice remains independent of component surfaces.

Keep the original pixel face (Silkscreen or Press Start 2P) where 1.22 used it; use `--bb-font-pixel` for the new shared top-bar titles and warning titles. Use Inter (`--font-body`) for body text, including alerts, and for control labels. Reserve large pixel type for short titles. Use consistent SVG icons with accessible names for icon-only actions.

## Components

Use the shared classes in `60-foundation.css`. Apply them explicitly on each new screen rather than overriding protected UI globally.

| Component | Hook and rules |
| --- | --- |
| Top bar | `.lb-block-topbar`: title in an `h1` (legacy bars also accept a title `span`); use `.lb-block-back` on the borderless Back button. Keep bar placement and ancillary actions intact. |
| Buttons and tabs | `.lb-block-btn` is secondary by default; use `--primary`, `--icon`, or `--danger` modifiers on the same base. Use `--locked` with an actual `disabled` button, a lock icon and a visible requirement. `.lb-block-tabs` groups native buttons with `role="tab"` and `aria-selected`; `.lb-block-tab` supports `aria-pressed` on filter buttons. |
| Switch | Use a labelled native checkbox with `role="switch"` inside `.lb-block-switch`, directly followed by a decorative `.toggle-slider`. The track and On/Off indicator follow the input state without JS; keep the whole control clickable. |
| Slider | `.lb-block-range` on a native range input. Use `min="0" max="100" step="5"` for percentages and show the current percentage beside it. Preserve existing units and steps for timings and discrete settings. |
| Progress | `.lb-block-progress` on a labelled native `<progress>` gives an instant, notched HP bar. Never replace XP, level or mission step bars with it. |
| Panel and disclosure | Use `.lb-block-card` or `.lb-block-panel`, with `.lb-block-panel-head` and `.lb-block-section-title` for headings. Use `<details class="lb-block-expand">` for collapsible content; put the content in `.lb-block-expand-body`. |
| Reward | `.lb-block-reward` with `data-rarity`, item art, a visible name and rarity, and a corner `.lb-block-reward-amount` badge. Use the shipped item art rather than text-only rewards. |
| Information | Align the small `.lb-block-info-icon` with the heading; use a labelled `summary` inside `.lb-block-info` for brief text in `.lb-block-tooltip`, or the existing `.lb-info-btn` for a link into Help. Keep advice accessible by keyboard and touch, not just hover. |
| Dialogs | `.lb-block-dialog` and `.lb-block-dialog-actions`, with `--warning` for destructive confirmation. Keep clear Cancel/Proceed actions and plain-language consequences. Preserve the rounded notice silhouette and use Inter for its message. |

## Review Rules

- Keep main-menu buttons, rank badges, XP/level display, missions and the in-game HUD intact. Preserve Credits content and layout.
- Buttons are rounded rectangles with 44px targets and visible focus; pills are only for tags, chips and badges. Pair colour with text, an icon or a state mark.
- Keep edges consistent, align labels and controls, and avoid needless motion. Check the real screen at 1280×800 and 390×844 in `?dev&demo` (see `docs/QA-SCREENS.md`) and verify accents and legibility across themes.
