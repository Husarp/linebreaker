# Linebreaker design book

A precision game interface: deep solid panels, clean typography and electric edges. Missions supply the visual starting point: tier borders, labelled rewards and segmented progress. This book and `ui/tokens.css` are a proposed shared contract; `ui/gallery.html` is its standalone approval surface. They do not change the game.

## Principles

1. Give each screen one clear primary action.
2. Centre the main column; keep side accessories outside its centring calculation.
3. Put readable content on solid neutral surfaces.
4. Reserve bright colour for interaction, identity and earned progress.
5. Pair colour with words, shapes or state marks.
6. Use one component for each job, with consistent spacing and touch behaviour.
7. Celebrate briefly; keep play responsive and motion inexpensive.

## Colour system

All names below are CSS properties prefixed `--`. The gallery inventories every property and displays live colour samples.

| Role | Tokens / values | Use |
| --- | --- | --- |
| Neutral surfaces | surface-0 #0b101b; surface-1 #141c2b; surface-2 #202b3d | Page furniture, cards/dialogs, inset controls respectively |
| Text | text #f3f6fc; text-muted #b5c2d6 | Primary and supporting copy; never reduce body opacity |
| Border | border #46566f | Visible quiet divisions |
| Theme | accent; background | Exactly one theme hue and one background |
| Derived accent | accent-soft 12% accent + surface-1; accent-border 65% accent + border; accent-bright 55% accent + white | Selection fill, edges, focus/title highlights |
| Accent ink | accent-ink #07101b | Dark text on solid accent actions across all ten themes |
| Semantic | success #44ff88; warning #ffcc44; danger #ff728a | Completion, attention, destructive action/error; always name the meaning |
| Rarity | rarity-common #b5c2d6; rare #73b5ff; epic #ce9aff; legendary #ffcc44; mythic #ff91d1 | Frames plus explicit rarity labels |
| Mission tier | mission-easy #44ff88; normal #4499ff; hard #ff3355; secret #cc88ff | Tier borders, progress and named badges; first three preserve existing mission colours, secret is purple |

Rank tokens preserve existing identity colours: rank-bronze #e8922a, rank-silver #c8d8e8, rank-gold #ffd700, rank-emerald #50c878, rank-sapphire #3377ff, rank-ruby #ff0033, rank-amethyst #8e44ad, rank-diamond #94ffff, rank-celestite #7ec8e3. Darker rank colours are decorative borders/icons, never small text; use neutral text for the rank name. Rarity values are proposed for legibility and consistency rather than binding legacy colours.

### Theme boundary

Use `data-theme` on the document root. Existing keys and primary colours: default #00ffff, ocean #0099ff, forest #00dd55, fire #ff3300, dragon #ffcc00, void #cc44ff, sunset #ff7722, arctic #88ddff, midnight #aa77ff, sakura #ff88cc. The CSS copies each existing THEMES background gradient exactly.

Theme overrides set **only background and accent**. Derived shades recompute on the root. Accent touches headers, edges, focus, selected controls and primary actions. Surface colours, text, geometry, semantics, rarity and rank remain unchanged. Cards, modals and popovers stay solid; never place translucent panels over moving or readable content. A translucent modal backdrop is allowed because its purpose is to obscure inactive content.

## Typography

Two production families: **Orbitron** for short titles and key numbers, **Inter** for UI/body. Both are bundled locally under OFL. Inter uses the official rsms/inter variable WOFF2 (`assets/fonts/inter/InterVariable.woff2`, weight 100–900) with its unmodified `OFL.txt`. Source: https://github.com/rsms/inter/tree/master/docs/font-files and https://github.com/rsms/inter/blob/master/LICENSE.txt. The gallery preloads both families; font-display: swap retains a system fallback during loading. No remote font service is used. Body samples use normal style; counters use tabular numerals.

| Token | Size (16px root) | Role |
| --- | --- | --- |
| text-xs | 12px | Short uppercase eyebrow only |
| text-sm | 14px | Auxiliary labels and metadata |
| text-body | 16px | Minimum body and control copy on phones |
| text-lead | 18px | Introductory copy |
| text-title | 20px | Card/screen titles |
| text-heading | 24px | Section heading |
| text-display | 32px | Short hero title/important number |
| text-hero | 40px | Desktop hero; reduce to display on narrow viewports |

Body line height `leading` 1.5; title `leading-title` 1.25; eyebrow `tracking` .08em. Use 400/600/700 body weights and 600/700 display weights. No long all-caps paragraphs; allow wrapping, zoom and text enlargement without clipping.

## Geometry and elevation

Spacing tokens space-1/2/3/4/6/8/12 = 4/8/12/16/24/32/48px. Use 8px internal gaps, 16px card padding, 24px between groups, 32–48px between major regions. Radius-sm/md/lg/pill = 6/12/20/999px for controls/cards/reveals/pills. Borders use border-width 1px; selected and rarity frames may use 2px. Focus uses focus-width 3px and focus-offset 3px.

`shadow` = 0 12px 32px #0006, reserved for floating dialogs. `glow` = 0 0 16px at 18% accent, reserved for interactive accent edges on hover or brief emphasis. Never glow paragraphs, every card, or full-screen backgrounds. No layered blur stacks.

Z layers: z-base 0, z-header 10, z-popover 20, z-backdrop 30, z-modal 40, z-toast 50. Native dialog top-layer behaviour takes precedence over ordinary z-index. Avoid nested stacking contexts around overlays; portal app overlays to the shell. Gallery toast remains in flow so its specimen never hides controls.

## Layout

A screen has header / content / footer; `lb-screen` implements that structure. One centring rule: main content has max width `column` 960px and automatic inline margins. Optional PC side panels are positioned outside that column and never included in its centring width. Avoid shifting the playfield when side content appears.

Portrait phone is the base: one content column, wrapping action groups, 16px gutters and safe-area insets on all edges. `phone` 390px is the gallery approval width; widths below that remain fluid. Under 600px reduce hero type and expand grouped actions. At 600–899px let card grids grow naturally. At 900px and above in landscape, use 32px vertical breathing room and allow external side add-ons. CSS media boundaries are 600 and 900px (custom properties cannot drive media queries). Header/footer scroll with content unless the game explicitly needs a sticky header; never let chrome consume phone play space. Use svh for the stable screen minimum height and allow document scrolling.

Every actionable element has a minimum 44 × 44px target (`target`), including icon buttons, summaries and labelled checkbox/toggle rows. Visual checkboxes may be 24px inside their larger label target. Preserve a minimum 8px gap between adjacent actions. The gallery phone toggle constrains the component catalogue to 390px and each full-screen specimen to 390×844; desktop specimens are 1280×720. The control bar remains outside the preview.

## States and accessibility

Hover: visible border plus underline on actions, optional static glow. Pressed: translate down 2px. Focus: visible 3px bright accent outline, 3px offset. Disabled: actual native disabled attribute, 50% opacity, no press/hover response. Selected: persistent 2px edge, solid accent-soft surface and check/text or selected accessibility state. Tabs use a persistent bottom marker and aria-pressed in a named button group, allowing ordinary Tab navigation. Hover is never the only cue.

Toggle and checkbox use native checkbox inputs with visible labels and native keyboard support. Sliders expose their value and retain native arrows. Progress includes an accessible label, current/max value and adjacent text; step bars expose a single verbal summary. Status/toast uses role=status; errors also need inline guidance and retry. Keep primary text at WCAG AA 4.5:1 and large text/control edges at 3:1 during integration checks. Named dark rank colours are not text. Do not use colour alone for completion, rarity or mission tier.

## Motion

Duration-fast 120ms for presses/toggles, duration-normal 200ms for entering panels, duration-reveal 320ms for one reward entrance. Ease is cubic-bezier(.2,.8,.2,1). Animate **transform and opacity only**: knob translation, brief button press, panel entrance and one optional reveal scale 0.96→1 with opacity 0→1. Change progress values immediately; never animate width. No animated box-shadow, filters, shimmer, background-position or infinite pulse loops. Honour prefers-reduced-motion with instant changes. Gallery rewards use static reveals so approval does not depend on animation.

## Icons

One SVG stroke system: 24 × 24 viewBox, icon-size 20px, icon-stroke 1.8, no fill, round caps/joins, currentColor. Icon-only buttons require accessible names; decorative SVGs are aria-hidden. Use the same back arrow, box, check and information vocabulary everywhere. No emoji in UI chrome. Text tick and information symbols in this gallery are state labels; production pictograms use the shared SVG style.

## Component catalogue

| Component | Anatomy / do | Don't |
| --- | --- | --- |
| Screen shell | lb-screen → header, main, footer; one centred column and safe gutters | Centre content together with PC add-ons |
| Header with back | lb-header; 44px named icon button, short title, optional status | Put unrelated primary actions beside Back |
| Tabs | lb-tabs; named button group, persistent selected edge, aria-pressed | Use hover as selection or mix navigation and filtering semantics |
| Buttons | lb-btn secondary default; --primary, --ghost, --danger, --claim; verb + optional icon | Use multiple primary actions in one region or claim styling for ordinary navigation |
| Icon button | lb-btn--icon; 44px square, SVG, accessible name | Rely on tooltip alone for name |
| Card | lb-card; tier/accent top edge, heading, body, progress, action | Nest decorative frames repeatedly or use transparent fills |
| List row | lb-row; label/detail left, state/control right; wrapping allowed | Force long text into ellipsis when it carries meaning |
| Toggle | lb-toggle; one native checkbox, track/knob and visible setting label | Introduce another switch implementation or use for one-off commands |
| Checkbox/tick | lb-check; native checkbox and 44px label; tick for completion | Confuse an earned tick with an editable checkbox |
| Slider | lb-slider; explicit label/value and native range input | Hide value or remove keyboard adjustment |
| XP / mission points / step progress | lb-progress native progress + label/value; lb-steps discrete marks + spoken summary | Animate width or show an unlabelled colour strip |
| Badge/pill | lb-pill; short status or currency, optional stroke icon | Make every label a badge or use colour without words |
| Rarity frame | lb-rarity; solid surface, named rarity, double inset coloured edge via --tone | Change body font/colour by rarity or stack glows |
| Modal | lb-modal native dialog; labelled title, concise content, action and Close; showModal handles focus trap/Escape | Hide Close or build a fake dialog without focus management |
| Toast | lb-toast; status mark, short result, optional action; don't steal focus | Put critical errors only in an expiring message |
| Tooltip/info i popover | lb-tip; anchored named information trigger, readable panel; gallery uses native details for touch/keyboard | Depend on hover or include essential instructions only in a tooltip |
| Reward reveal | lb-reveal; named rarity, item title, explanation, equip/dismiss | Infinite sparkle/filter loops or auto-dismiss before reading |
| Empty state | lb-empty; reason, reassuring explanation, next action | Leave an empty frame or use only an illustration |

Gallery specimens show resting and simulated hover/pressed/focus/disabled/selected button states, native on/off/disabled controls, empty/partial/full progress, all rarities and live dialog/toast/reveal examples. Simulated state classes are labelled for review and should not be applied as app state. Context colours are supplied with `--tone` for borders/progress while text remains neutral. All tokens are inspectable at the end of the gallery.

## Approval questions

- Approve the bundled Orbitron + Inter pairing?
- Approve the solid neutral panel direction and quieter glow treatment across all themes?
- Approve the proposed secret mission purple and rarity palette, or retain another established identity?

## Verification boundary

This ticket requires static checks only: no browser opened. Validate HTML nesting, unique IDs, local assets, gallery class coverage, theme parity and JavaScript syntax. Visual balance, real-device touch behaviour, text zoom, screen-reader behaviour and contrast over the final bundled Inter font remain owner acceptance checks. No changes to app.js, index.html or style.css are part of this delivery.


## Game motifs

Use a four-cell T mino as a small section or logo marker, never as a replacement for a label. Cards have two square corners suggesting a block notch. Full-screen backgrounds have a faint static 24px well grid; readable panels remain solid. Collectible rarity frames have a double inset edge, clipped-looking corners, a quiet diagonal surface and a written rarity. Rank samples show Bronze, Silver, Gold, Emerald, Sapphire, Ruby, Amethyst, Diamond and Celestite with a geometric emblem and neutral name. Do not animate textures, filters or shadows.

## Reward accounting

Missions award **points**, never XP. Easy is green, normal blue, hard red and secret purple. A completed mission has a tier-coloured `CLAIM +20 PTS` action. Claimed points fill daily/weekly progress toward milestone box icons; the gallery shows both periods explicitly. Games and badge claims award XP. Mission task progress and milestone points are separate quantities. All costs and rewards in the static screens are illustrative balance values.

## Screen templates

Every `lb-mock` is a complete static screen: header, main content and footer. The existing preview toggle switches all seven between **1280×720 desktop** and **390×844 phone**, independent of browser viewport. A horizontal rail lets small browsers inspect the full desktop canvas; each screen permits vertical scrolling for enlarged text. Container queries reflow based on the specimen width. These controls illustrate placement; they do not navigate or run gameplay.

| Screen | Template and responsive behaviour |
| --- | --- |
| Main menu | Centred rank, game XP, parts and best score; Play is primary; Missions, Achievements, Inventory and Settings are secondary. |
| Game HUD | Centred 10×20 well with static minos; hold left, next queue right; score, lines, level, speed, combo and Pause visible. Phone reduces well to 180×360 and narrows side rails. |
| Pause | Focused solid panel with run context, Resume primary, Settings, Restart and Main menu. A production overlay must use native dialog focus handling. |
| Game over | Score, XP gained, best and level progress; Play again primary. Available boosters sit to the right on desktop and below on phone. |
| Achievements | All/Locked/Unlocked/Categories filters, sort, x of y, overall progress and named locked/unlocked rows. Badge claim explicitly awards XP. |
| Settings | Audio, gameplay/controls and accessibility/display groups with native labelled rows. |
| Inventory / skins | Parts balance and collectible rarity grid; owned/equipped states and explicit unlock costs in parts. Two columns on phone. |
