# CEE 406 — Chart & Dashboard Visual Standards

**Status: binding.** Every chart, KPI, table, and tool surface added to this site follows this
document. It is the "soft-analytics" dashboard language (near-white page, hairline cards,
generous radii, stripped chart chrome, color doing the semantic work) *bound to the CEE 406
identity* — UIUC navy `#0F1A2E` / Illini orange `#E87722`, Sora + IBM Plex, dark mode.

Two layers:

- **§A The standard** — the design language itself. Rules, tokens, chart catalog, anti-patterns.
- **§B The CEE 406 binding** — how each token maps onto this site's existing palette and
  components, and every deliberate deviation with its reason. When §A and §B disagree, §B wins.

---

# §A — The standard

## A0. The design thesis in one paragraph

A **near-white page**, **white cards with a hairline border and almost no shadow**, **generous
corner radii (12–16 px)**, a **geometric-humanist sans with tight tracking**, and **charts stripped
of every piece of chrome that isn't load-bearing**. Color does almost all of the semantic work.
One brand hue owns the UI and then either (a) expands into a **monochrome ramp** for ordered/stacked
data, or (b) gives way to a **fixed categorical set** for unordered data. **Bar/segment geometry is
treated as a rounded physical object**: pills, capsules, hexes, dots and ticks, not rectangles.
Texture (diagonal hatch, vertical gradient fade, ghost tracks) is used sparingly to encode a
*second* layer of meaning (target, remainder, forecast) rather than for decoration.

### The ten rules

1. Page is off-white; every content block is a white card with a 1 px hairline border and no or near-zero shadow.
2. Radius scale is aggressive: cards 14–16 px, chips/pills 8–999 px, bar caps 4–8 px, heatmap cells 6–8 px.
3. One brand hue per product. Charts use it for the primary series; everything else is neutral or a fixed categorical set.
4. Ordered data → monochrome ramp of one hue. Unordered data → categorical hues. Never mix the two in one chart.
5. No axis lines, no ticks, no borders around the plot area. Horizontal gridlines only, dashed or ultra-light, and often omitted.
6. The y-axis is dropped whenever the magnitude is already stated in the KPI above the chart.
7. Legends live **below** the plot, left- or center-aligned, 8 px round dots, 13 px muted-gray labels.
8. Every card header is `title (16–18 px semibold)` + a right-side affordance (`···`, a filter chip, or a select).
9. Deltas are always `arrow + colored % + gray context phrase`. Green up, red down, never colored backgrounds.
10. Bars are objects: rounded caps, gaps between stacked segments, ghost tracks behind, gradients fading to the baseline.

## A1. Layout system

### A1.1 Shell

| Shell | Sidebar width | Notes |
|---|---|---|
| **Left rail + content** | 240–280 px | Default for ≥ 8 destinations |
| **Top nav + content** | — | Use when ≤ 8 destinations; active item is a white pill with a soft shadow on a gray track |

**Left rail spec**

- Background white or 1–2 % darker than the page; separated by a 1 px right border, *not* a shadow.
- Top: brand mark (32 px rounded-square logo tile + wordmark) and a **collapse button** — 32 px rounded-square, 1 px border, `chevrons-left` icon.
- Grouping: uppercase section labels, 11–12 px, `letter-spacing: 0.06em`, muted gray. Groups may be collapsible with a chevron on the right.
- Item: 20 px outline icon + 14–15 px label, 40 px row height, 10 px gap, 10 px horizontal padding.
- **Active state:** filled rounded-rect (10–12 px radius) in a 4 % neutral tint, text and icon at full-strength primary. *Not* a brand-colored pill — brand color is reserved for data and primary actions.
- Sub-items: indented 28 px, connected by a 1 px vertical hairline with short horizontal ticks. Icon dropped at sub-level.
- Badges: right-aligned pill, 20 px tall — brand-tinted for actionable counts, neutral gray for informational counts.
- Footer block: utility links separated by a top hairline; destructive/`Logout` in red.
- Optional promo/onboarding card at the bottom: 12 px radius, soft gradient image header, title 14 px semibold, body 12–13 px muted, a mini circular-progress indicator, and a ghost + solid button pair.

### A1.2 Top bar

`Page title (24–28 px semibold)` left; right, in order: **primary action** (black or brand pill),
a divider, 36 px circular ghost icon buttons (search, help, notifications with a 6 px dot), then
the account chip (24 px avatar + name + `chevrons-up-down`). Height 64–72 px, bottom hairline,
no shadow.

### A1.3 Control row

Directly under the title, a single row of controls, 36–40 px tall, 8–12 px gaps:

- **Select pills**: white, 1 px border, 999 px or 10 px radius, leading 16 px outline icon, label, trailing chevron.
- **Add filter**: `+` glyph + label, same pill.
- **Segmented control**: gray track, active = white pill with a 1 px border and a very soft shadow; a status dot may sit inside a segment.
- **Tabs**: text-only, 15 px, active is full-strength text with a 2 px underline flush to the row's bottom border; inactive muted. Tabs for *views*, segmented controls for *filters*.
- Right-aligned secondary action with a leading icon.

### A1.4 Grid & proportions

- 12-column grid, 24 px gutter, 24–32 px page padding, content max-width 1440–1600 px.
- Vertical rhythm: 8 pt base. Card gap 20–24 px.
- Canonical row splits: `12` (KPI strip), `8 / 4`, `6 / 6`, `4 / 4 / 4`, `7 / 5`.
- **Card heights**: KPI strip 150–180 px; standard chart card 360–420 px; tall list/table card 460–560 px. Charts get 240–300 px of plot height after header, legend, and padding.
- Reading order is enforced: **KPI strip → primary trend → distribution/secondary → tables/lists last.**
- Plot aspect ratio between 16:9 and 2:1. Never taller than wide except for horizontal-category charts.

## A2. Typography

### A2.1 Faces

A **geometric-humanist grotesque** — generous apertures, slightly rounded terminals.

| Role | Recommended | Fallback stack |
|---|---|---|
| Display / KPI numerals | **General Sans** or **Aeonik** (600/700) | `"General Sans", "Aeonik", Inter, system-ui` |
| UI / body | **Inter** or **Geist** (400/500/600) | `Inter, "Geist", system-ui, -apple-system` |
| Data & tables | Same body face with `font-variant-numeric: tabular-nums` | — |

No serif. No mono except for IDs, hashes, and code. *(See §B2 — this site substitutes Sora + IBM Plex.)*

### A2.2 Scale

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-kpi` | 40 / 44 | 700 | −0.03em | Hero metric |
| `metric-lg` | 30–34 / 38 | 600 | −0.02em | Card metric |
| `metric-md` | 22–24 / 28 | 600 | −0.02em | Inline metric |
| `title-page` | 26 / 32 | 600 | −0.02em | Page title |
| `title-card` | 17 / 24 | 600 | −0.01em | Card header |
| `subtitle` | 13–14 / 20 | 400 | 0 | Gray card sub-caption |
| `body` | 14–15 / 22 | 400/500 | 0 | Rows, table cells |
| `label` | 13 / 18 | 500 | 0 | Legends, KPI labels |
| `caption` | 12 / 16 | 500 | 0 | Axis ticks, deltas, chips |
| `eyebrow` | 11 / 14 | 600 | +0.06em, uppercase | Section headers |

### A2.3 Rules

- KPI values are the **only** place tracking goes below −0.02em.
- Axis tick labels: 12 px, muted gray, weight 500, never bold, **never rotated**. If labels would rotate, reduce tick count or switch to a horizontal-category chart.
- Numbers in tables and legends: **tabular figures, right-aligned**. Currency and % keep the symbol attached.
- Card titles are sentence case. Section eyebrows are uppercase. **No title case anywhere.**
- Sub-captions under a card title carry the encoding explanation that the stripped chart chrome no longer provides. Use them.

## A3. Color system — light mode

### A3.1 Neutrals

| Token | Hex | Use |
|---|---|---|
| `bg/page` | `#F7F8F8` | App background |
| `bg/surface` | `#FFFFFF` | Cards |
| `bg/sunken` | `#F2F4F5` | Inner nested card, segmented-control track, table header |
| `bg/hover` | `#F5F6F7` | Row and nav hover |
| `border/hairline` | `#ECEDEF` | Card border, table dividers |
| `border/control` | `#DFE2E5` | Input and select borders |
| `grid/line` | `#F0F1F3` | Chart gridlines (or `#E4E7EC` dashed) |
| `text/primary` | `#101418` | Headings, values |
| `text/secondary` | `#5B6670` | Body, sub-captions |
| `text/muted` | `#98A2AC` | Axis ticks, placeholder |
| `track/ghost` | `#EDEFF1` | Empty portion of progress and target bars |

Card shadow: `0 1px 2px rgba(16,24,40,0.04)` maximum. Elevated (tooltip, dropdown, active segment):
`0 8px 24px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)`.

### A3.2 Brand hue

One per product. Appears in primary buttons, the primary data series, progress fills, and
active-tab underlines. It does **not** appear in navigation active states or in body text.

### A3.3 Categorical palette (unordered series, max 6 in one chart)

Assign **1 → 6 in the listed order, never by data value**, so a series keeps its color across
every chart in the product. Reserve the 6th for a genuine 6th series; 5 hues is the practical
ceiling before the legend becomes work.

### A3.4 Sequential ramps (ordered / stacked / heatmap)

5-step, dark→light. Dark for the base of a stack or the high end of a heatmap. Heatmaps use the
ramp as a **continuous** interpolation and always ship a gradient legend bar with `Low` / `High`
end labels. Never a diverging or rainbow scale unless the measure has a true midpoint.

### A3.5 Semantic

| Token | Hex | Tint | Use |
|---|---|---|---|
| `positive` | `#12B76A` | `#E6F7EF` | Up deltas, "on target" |
| `negative` | `#E5484D` | `#FDECEC` | Down deltas, "at risk" |
| `warning` | `#F59E0B` | `#FEF3E2` | "In progress", pending risk |
| `info` | `#3B9BF0` | `#E8F3FE` | Neutral notice |
| `neutral` | `#98A2AC` | `#F2F4F5` | "Pending", disabled |

Semantic color is **text + icon on a tint background** for pills, and **text + icon only** for
deltas. Never a saturated fill behind white text at these sizes.

## A4. Dark mode

Dark mode is not an inversion — it is a re-derivation with three transformations.

### A4.1 Surfaces

Elevation in dark mode is expressed by **surface lightness, not shadow**. `bg/sunken` is *darker*
than the card, not lighter. `text/primary` is never pure white.

### A4.2 Data hues

- **+8–12 % lightness, −8–12 % saturation.** Saturated mid-tones vibrate on black.
- Minimum contrast against `bg/surface`: **3:1** for a filled shape, **4.5:1** for a 1–2 px line or a text label.
- Sequential ramps **reverse direction of extension**: light mode runs dark→light with light as "empty"; dark mode runs **light→dark with dark as "empty"**. Same hue, same 5 stops, re-mapped ends.

### A4.3 Textures and fades

- Gradient area fills fade to **`transparent`**, never to a color. Same code, correct result on both surfaces.
- Diagonal hatch: light `rgba(255,255,255,0.35)` over the fill; dark `rgba(0,0,0,0.30)` over the fill. The hatch always *removes* light, so it inverts.
- Ghost / target bars and dot-matrix background dots follow the `track/ghost` token per mode.

### A4.4 Brand hue in dark

Shift the brand one step lighter and use the *tint* as a low-alpha wash instead of a solid pastel.
Note the reversal: **light mode hover goes darker, dark mode hover goes lighter.**

## A5. Iconography

- **Style:** outline/stroke, 1.5–1.75 px, rounded caps and joins, 24 px optical grid (Lucide, or Phosphor Regular).
- **Sizes:** 16 px inline/chips, 18 px table rows, 20 px navigation, 24 px card-header feature icons.
- **Color:** icons inherit text color — `text/secondary` at rest, `text/primary` when active. A colored icon means it encodes data (legend dot, status arrow), not decoration.
- **Feature icon tiles:** 36–40 px rounded-square (10 px radius), background = the relevant hue at 10–12 % tint, icon in the full hue. One per card header or status card.
- **Status dots:** 6–8 px filled circles. Legend dots 8 px, `border-radius: 50%`, 8 px gap to the label.
- **Delta arrows:** either bare `arrow-up`/`arrow-down` in the semantic color, or a 16 px filled circle with a white arrow. Pick one per product.

## A6. Component vocabulary

### A6.1 Card

```
radius 16px · bg surface · border 1px hairline · padding 20–24px
header: title(17/600) [+ subtitle(13, secondary)]  ······  affordance
optional 1px hairline under header (when the card body is a metric strip)
body
```

Affordance is one of: `···` overflow in a 32 px rounded-square ghost button; a filter chip; a
select pill; a stat chip; or a text link with a trailing arrow.

### A6.2 KPI strip

Full-width card, header row, hairline, then **N equal columns separated by 1 px vertical hairlines**:

```
label   (14, secondary)
value   (40/700, primary, tracking −0.03em)
delta   (↑ 8.3% [positive]) + " from last week" (13, muted)
```

Alternative: the strip contains **nested cards** on `bg/sunken` with their own 12 px radius — use
when metrics belong to two groups that need a visual break.

### A6.3 Chips & pills

| Type | Spec |
|---|---|
| Filter/select pill | 36 px, 999 px or 10 px radius, white, 1 px control border, icon + label + chevron |
| Stat chip | 28 px, 8 px radius, `bg/sunken`, 12 px caption |
| Status pill | 24–26 px, 6–8 px radius, semantic tint bg + semantic text, 12 px/600 |
| Meta chip | 24 px, 6 px radius, `bg/sunken`, 16 px leading icon + value |
| Keyboard hint | 20 px square, 6 px radius, `bg/sunken`, mono-ish 11 px |

### A6.4 Buttons

- **Primary:** solid black or solid brand, 999 px or 10 px radius, 40 px, 14/600, optional leading icon. Black reads as "system action"; brand reads as "commit the current object".
- **Secondary:** white, 1 px control border, same geometry.
- **Ghost icon:** 32–36 px square/circle, no border at rest, `bg/hover` on hover.
- **Icon-only accent:** 40 px rounded-square (10 px radius) in brand, white glyph — the single "create" action.

### A6.5 Table

- Header row: 12–13 px, `text/muted`, weight 500, `bg/sunken` or transparent with a bottom hairline. **No vertical rules.**
- Rows: 56–64 px, bottom hairline, `bg/hover` on hover. No zebra striping.
- First column: identity. Numeric columns right-aligned, tabular figures.
- Progress and status render **inline in the row**, not in a drawer.
- Trailing `···` column, 40 px wide. Leaderboard variant adds a leading 40 px rank column, `text/muted`, weight 600.

### A6.6 Ranked list

Each row is its own bordered card (12 px radius, 1 px hairline, 8 px vertical gap) — **not** a
table. Circular rank badge (24 px, `bg/sunken`), 24 px logo, name (15/500), optional trailing metric.

### A6.7 Tooltip

Surface-colored, 12 px radius, 12–14 px padding, elevated shadow, **no arrow**:

```
Title (13/600)                    ← the x-category
● Series label            value   ← 8px dot, label secondary, value primary right-aligned tabular
```

Triggered by a **vertical hover line** in time-series charts; the intersected point gets a 6 px
filled dot with a 2 px surface-colored ring.

### A6.8 Banner

Full-width, 12 px radius, semantic tint background, no border. Leading 20 px icon, message with
**bolded colored spans** on the key nouns, trailing outline button. One per page, maximum.

## A7. Chart chrome — the stripped-back rules

| Element | Rule |
|---|---|
| Plot border | None |
| Axis lines | None (no domain line, no ticks) |
| Y gridlines | Horizontal only. 1 px `grid/line` solid, or 1 px dashed `4 2`. **3–5 lines maximum.** |
| X gridlines | Only when the chart is a matrix/cell grid, and then as dashed cell separators |
| Y axis labels | Omit whenever the magnitude appears in a KPI or on the marks. When kept: 12 px muted, 3–5 values, no unit repetition (unit on the top label or in the subtitle) |
| X axis labels | 12 px muted, horizontal, abbreviated. Thin to every 2nd/3rd label rather than rotating |
| Legend | Below the plot, 12–16 px above the card's bottom padding. 8 px round dots, 13 px muted labels, 20–24 px gaps. Centered for 2 series, left-aligned for 3+ |
| Zero baseline | Implied by the lowest gridline; never drawn as a heavier rule |
| Direct labels | Preferred over legends for ≤ 3 categories in composition bars |
| Annotation | A single vertical marker line (1 px, `border/control`) with a dot is the only permitted in-plot annotation |

**Bar geometry defaults**

- Category padding 0.35–0.45 (bars occupy ~60 % of the band); intra-group padding 0.08–0.12.
- Corner radius `min(6px, barWidth/3)` on the value end only; both ends for floating/range bars.
- Stacked segments separated by a **2–3 px gap**, each segment carrying the radius.
- Minimum bar width 10 px, maximum 64 px. **Cap the count before you thin the bars.**

## A8. Chart type catalog

**8.1 Paired grouped bars** — two series per category, same hue at two lightnesses. For
generated-vs-converted / planned-vs-actual where both share a unit and one is a subset or
successor of the other. Bar width 26–34 px, 4 px intra-pair gap, 6 px top radius, 3 gridlines, no
y-axis, legend centered below. Light member always left. Never more than two members per group.

**8.2 Target-vs-actual layered bars** — a pale ghost bar (target) behind a shorter saturated
gradient bar (actual). Ghost = `track/ghost` or brand at 8 %, optionally hatched above the actual.
Actual = vertical gradient from the hue fading to ~20 % alpha at the baseline. Same width and
x-position, ghost first, 6 px radius both. In a KPI card the whole chart becomes decorative
background — drop labels and gridlines, bleed to the card edge at 40 % opacity.

**8.3 Stacked columns, monochrome ramp** — 5 segments in one hue's ramp, darkest at the base, 3 px
gaps, 4 px segment radius, optional 45° hatch. Composition of an *ordered* set across time. 12
categories max. The eye reads a ramp as ordered, so the stack order becomes self-documenting.

**8.4 Segmented pill columns with whiskers** — each x-category is a column of detached rounded
capsules, one per series, height encoding value; thin stems with terminal dots above and below;
faint dashed cell grid behind. For 4–6 sources across 7–14 buckets where you want per-series
magnitude *and* a sense of the envelope without the misreading a true stack invites. Capsule
44–56 px wide, 10 px radius, min height 24 px, 8–10 px vertical gap. **Capsules do not sum to a
meaningful total — never label it as stacked and never put a y-axis on it.**

**8.5 Gradient area + line with forecast** — 2 px line over an area filled with a vertical gradient
fading to transparent; 1 px vertical marker line with a filled dot; beyond it the line continues
**dotted** at 60 % opacity with the fill dropping to 8 %. `curveMonotoneX`, never an overshooting
spline. Marker 7 px filled dot with a 2 px surface ring.

**8.6 Micro-histogram baseline** — a row of very short pale bars along the x-axis beneath an area
chart, encoding a secondary count. Bottom 15–18 % of the plot, hue at 25 % opacity, 3 px radius,
shares the x-scale exactly, legend entry but no axis. If the reader needs to compare its values,
it deserves its own card.

**8.7 Horizontal range bars with whiskers** — per category, a floating two-tone horizontal bar with
1 px whiskers ending in 4 px dots. Distributions or before→after ranges across 4–8 named stages.
Height 26–32 px, fully rounded at the outer ends, square at the internal split, two lightnesses of
one hue. Category labels in a fixed 80–110 px gutter. **The correct chart when categories are few
and labels are long** — it removes the rotated-label problem entirely.

**8.8 Progress bar with hatched remainder** — label above, % right-aligned; a full-width bar whose
filled portion is solid and whose remainder is a **hatched tint of the same hue** rather than gray.
For 3–6 *independent* percentages (each row its own 100 %). Height 12–14 px, fully rounded.

**8.9 Ticked "equalizer" bar** — a progress bar rendered as ~50 discrete 2 px vertical ticks;
filled ticks in the category hue, empty in `track/ghost`. For scores and ratings where you want to
suggest *granularity and measurement*. Deliberately different from 8.8 so both can coexist.

**8.10 Multi-segment composition bar** — one horizontal bar broken into 4 **detached** rounded
segments, each its own hue with a left→right gradient fading out and an inline % chip. For a
breakdown of exactly one total, 3–5 parts. Height 28 px, radius 8 px, 8 px gaps. The gaps mean it
is not a precise part-to-whole read — acceptable only because the % is printed on every segment.

**8.11 Rounded-cell heatmap** — rows = category, columns = bucket, color = sequential ramp. Cell
56 × 44 px, radius 8 px, **6 px gap** (the gap is what makes it read as modern rather than as a
spreadsheet). Lowest ramp step must still be visible against the card. **Always** ship a continuous
gradient legend bar (6 px tall, fully rounded, 160–220 px wide) with `Low` / `High` labels.

**8.12 Hexbin / honeycomb composition** — each hex = one countable unit, colored by category,
arranged in an organic blob with pale empty hexes filling the field. 3–5 categories. Hex radius
10–14 px, 2 px gutter, pointy-top. Sort so the largest category forms the outer ring. Expensive to
read precisely — only use when an accompanying list carries the exact numbers.

**8.13 Dot-matrix column chart** — each column is a stack of small dots on a background dot field;
height quantized to the grid. For a countable metric over time. Dot 4–5 px, 3 px pitch, background
grid at the hairline color. Y labels only, 4 steps. **Quantization error must be ≤ 1 dot at the
smallest column** — pick the dot value from the data range, not the pixel grid.

**8.14 Podium bar chart** — three bars in 2nd–1st–3rd order with avatars above and a % pill at the
foot. Equal widths, heights proportional with a 0.65 floor, 12 px top radius. The one place
categorical hues encode a ranked quantity — it works only because the rank is printed. A display
object, not an analysis chart.

**8.15 Decorative KPI background chart** — a chart at 30–45 % opacity behind a headline number,
bleeding to the card edges, no labels, no axis, no legend, `aria-hidden="true"`. If a reader would
ever need a value from it, it is the wrong pattern.

**8.16 Leaderboard table** — rank + identity, then 3–5 right-aligned numeric columns; card subtitle
states the population. Row 64 px, hairline dividers, no zebra. Optional inline micro-bar behind
**one** metric at 10 % hue.

**8.17 Object-row table with inline progress and status** — name + meta chips, owner, an inline
progress bar (8 px, fully rounded, hatched brand fill on `track/ghost`, fixed 180 px column), a
status pill, and a `···` menu.

### A8.18 Selection guide

| Question | Chart |
|---|---|
| One metric over time | 8.5 area+line; 8.13 dot-matrix if countable |
| Two comparable series over time | 8.1 paired bars |
| Actual against a target | 8.2 layered bars |
| Composition over time, ordered parts | 8.3 stacked ramp |
| Several sources over time, no meaningful total | 8.4 pill columns |
| Composition of one total | 8.10 segment bar; 8.12 hexbin if unit-countable |
| Independent percentages, few rows | 8.8 hatched progress; 8.9 ticks for scores |
| Distribution / range per named stage | 8.7 horizontal range bars |
| Two categorical dimensions × intensity | 8.11 heatmap |
| Rank of entities | 8.16 leaderboard; 8.14 podium only for a top-3 showcase |

## A9. Texture & fill recipes

```svg
<!-- 45° hatch, light mode -->
<pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.30)" stroke-width="1.5"/>
</pattern>

<!-- vertical fade for area/bar fills -->
<linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="currentColor" stop-opacity="0.22"/>
  <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
</linearGradient>

<!-- horizontal fade for composition segments -->
<linearGradient id="fadeRight" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%"   stop-color="currentColor" stop-opacity="1"/>
  <stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/>
</linearGradient>
```

- **One texture per card.** Hatch and gradient may coexist on the same mark; a card must not mix hatched bars with dot-matrix columns.
- Hatch always encodes "projected / remaining / not-yet-real". Solid encodes actual.
- Gradients fade **toward the baseline**, so the mark looks anchored. Never fade toward the value end.
- Opacity floors: filled marks ≥ 0.85; supporting marks 0.20–0.30; decorative 0.30–0.45.

## A10. Motion

- Chart entrance: bars grow from the baseline, `320 ms`, `cubic-bezier(0.22, 1, 0.36, 1)`, `stagger 24 ms` by category. Lines draw left→right over `500 ms`. **Once on mount, never on filter change** (re-render with a `220 ms` value tween instead).
- Hover: `120 ms` on opacity/fill only. Non-hovered series drop to 35 % opacity.
- Tooltip: `100 ms` fade + `4 px` translate, no scale.
- Number transitions: tween the value, not the opacity, `400 ms`.
- Respect `prefers-reduced-motion: reduce` — disable entrance and draw animations, keep the 120 ms hover feedback.

## A11. Accessibility

- Text on tint backgrounds clears **4.5:1**; chart hues clear **3:1** against the card as filled shapes. Re-verify after any dark-mode re-derivation.
- **Never encode by color alone**: pair with position (fixed legend order), direct labels, or shape.
- The 6-hue categorical set is distinguishable under deuteranopia **only if** live series are capped at 4 on a single chart. Beyond 4, add direct labels.
- Every chart needs an accessible name and a text alternative — the card subtitle or a visually-hidden `<figcaption>` stating the takeaway.
- Focus rings: 2 px brand outline with a 2 px surface offset, on every interactive chart element and control.
- Minimum 24 × 24 px hit target; use an invisible overlay rect per category band rather than the mark itself.

## A12. Anti-patterns

- Pie and donut charts. §8.10 and §8.12 replace them.
- 3D, bevels, drop shadows on data marks.
- Dual y-axes. Use §8.6 or stack two cards.
- Rainbow / spectral scales for sequential data.
- Rotated axis labels. Switch orientation instead.
- Colored card backgrounds. Only banners get a tint.
- Gridlines heavier than 1 px, or vertical gridlines on a time series.
- More than 6 categorical series, or re-ordering series color by value between renders.
- Truncated y-axis on a bar chart. **Bars start at zero, always.** (Lines may not.)
- The brand hue used simultaneously for a data series and a UI control inside the same card.

## A13. Implementation checklist

- [ ] Page `bg/page`, cards `bg/surface` + hairline, radius 16 px
- [ ] Card header: 17/600 title, optional 13 px subtitle, right-side affordance
- [ ] Plot area: no border, no axis lines, ≤ 5 horizontal gridlines
- [ ] Y-axis dropped if the magnitude is stated elsewhere on the card
- [ ] Bars rounded, ≥ 10 px wide, stacked segments gapped 3 px
- [ ] One hue ramp for ordered data / fixed categorical order for unordered
- [ ] Legend below, 8 px dots, 13 px muted labels
- [ ] Tooltip: category title + dot/label/value rows, tabular figures
- [ ] Delta = arrow + semantic % + gray context phrase
- [ ] Dark mode: surfaces re-derived (not inverted), hues +10 L / −10 S, fades to `transparent`
- [ ] `prefers-reduced-motion` honored; focus rings present; `<figcaption>` written

---

# §B — The CEE 406 binding

The site is a course portal, not a SaaS dashboard: the "product" is a set of six-plus engineering
tools, each a two-column `input panel / results` layout. §A's shell, top bar, and nav rules apply
to the tool chrome we actually have; the chart, card, KPI, table, color, and motion rules apply
verbatim.

## B1. Token map

Bind §A tokens to the existing CSS custom properties in `src/styles/global.css`. Dark mode keeps
the **UIUC navy** ladder rather than §A4.1's near-black — that navy is the site's identity — but
obeys §A4.1's *structure* (sunken darker than card, elevation by lightness, text never pure white).

| §A token | Light | Dark (navy-bound) | Notes |
|---|---|---|---|
| `bg/page` | `#F8F9FB` | `#0F1A2E` | existing `--color-surface` |
| `bg/surface` (card) | `#FFFFFF` | `#162033` | existing `--color-surface-alt` in dark |
| `bg/sunken` | `#F2F4F5` | `#101B2F` | **new** — darker than the card, per §A4.1 |
| `bg/hover` | `#F5F6F7` | `#1B2740` | **new** |
| `border/hairline` | `#ECEDEF` | `rgba(255,255,255,0.07)` | **new** — cards and table dividers |
| `border/control` | `#D1D5DB` | `#2D3F59` | existing `--color-border`, keeps its weight for inputs |
| `grid/line` | `#F0F1F3` | `rgba(255,255,255,0.06)` | **replaces** today's `#E5E7EB` / `#2D3F59` chart grid — today's is far too heavy |
| `text/primary` | `#1A1A2E` | `#F1F5F9` | existing `--color-text` (navy-tinted ink, kept) |
| `text/secondary` | `#5B6670` | `#9BA4AC` | **new** |
| `text/muted` (axis ticks) | `#98A2AC` | `#7C8CA5` | **new** — lighter than today's `#6B7280` |
| `track/ghost` | `#EDEFF1` | `rgba(255,255,255,0.07)` | **new** |

Card shadow and elevated shadow exactly as §A3.1.

## B2. Typography binding

**Deviation (deliberate):** we do not adopt General Sans / Aeonik / Inter. The site's Sora +
IBM Plex pairing is part of the course identity and already loaded; adding a third family would
cost a webfont round-trip for no semantic gain. Sora *is* a geometric-humanist grotesque and
satisfies §A2.1's intent.

| §A role | CEE 406 face |
|---|---|
| Display / KPI numerals | **Sora** 700, tracking −0.03em, `font-variant-numeric: tabular-nums` |
| Card titles, page titles | **Sora** 600 |
| UI / body / sub-captions | **IBM Plex Sans** 400/500 |
| Data, tables, axis ticks, legends | **IBM Plex Mono** (inherently tabular — satisfies §A2.3's tabular-figures rule and reads as "measured data") |

The §A2.2 **size, weight, and tracking scale is adopted unchanged.** Axis ticks move from today's
10.5 px to **11.5 px** — mono runs small, so 11.5 px mono ≈ 12 px sans optically.

**Greek-letter rule (carried over from CLAUDE.md):** never apply CSS `text-transform: uppercase`
to a label that may contain Greek (σ → Σ). §A2.3 already forbids title case and restricts uppercase
to eyebrows; KPI labels therefore become **sentence case, 14 px secondary**, which resolves the
existing hazard rather than working around it.

## B3. Brand hue

**Illini Orange.** Per §A3.2 it owns primary buttons, the primary data series, progress fills, and
active-tab underlines — and per §A12 it must not be a data series and a UI control in the same card.

```
--brand:       #E87722   (light)      #F0913F   (dark, +10 L / −10 S per §A4.2)
--brand-wash:  #FDF0E6   (light)      rgba(240,145,63,0.14)  (dark)
--brand-deep:  #C2500F   (light)      #F6B37B   (dark — lighter, per §A4.4)
```

## B4. Categorical palette (fixed order)

§A3.3's set with **Illini Orange substituted for its orange and promoted to position 1**, so the
brand hue is always the primary series.

| # | Name | Light | Dark |
|---|---|---|---|
| 1 | Orange (brand) | `#E87722` | `#F0913F` |
| 2 | Blue | `#3B9BF0` | `#5AAEF5` |
| 3 | Emerald | `#14B489` | `#2FC79C` |
| 4 | Amber | `#F5B62E` | `#F7C64F` |
| 5 | Violet | `#8B5CF6` | `#A78BFA` |
| 6 | Pink | `#F0388B` | `#F5619F` |

**Semantic series binding — the important part.** In this product the "series" are physical
quantities that recur across tools. Bind them once so σz is the same color in the Stress Explorer,
the layered-elastic solver, and the Westergaard tool:

| Quantity | Hue |
|---|---|
| Stress (σ), load, pressure | 1 Orange |
| Strain (ε) | 2 Blue |
| Deflection / displacement (w, δ) | 3 Emerald |
| Traffic, cost, GHG, mass | 4 Amber |
| Damage, fatigue, cracking | 5 Violet |
| Temperature, curling, moisture | 6 Pink |

Totals and envelopes are drawn in `text/primary`, heavier stroke — a neutral, not a 7th hue.
**Never re-order by value between renders** (§A12).

## B5. Sequential ramps

| Ramp | 900 | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| **Orange** (pressure bulbs, stress heatmaps) | `#8A3D0B` | `#C2410C` | `#EA580C` | `#FB923C` | `#FED7AA` |
| Blue (strain fields) | `#12447F` | `#1B67C4` | `#3B9BF0` | `#93C6F8` | `#E4F0FD` |
| Emerald (deflection basins) | `#0B7A5D` | `#12A57F` | `#34C79E` | `#8FE0C6` | `#E4F7F1` |
| Neutral | `#3F474E` | `#6B757E` | `#98A2AC` | `#CBD2D8` | `#EDEFF1` |

Per §A4.2 the ramp **reverses its empty end in dark mode**. The Stress Explorer's pressure bulb
already does this ad-hoc; it moves into `chartTheme.ts` as the single source.

**Deviation 1 — continuous magnitude fields do not reverse.** §A4.2's reversal is right for a
*count*: a cell with nothing in it should sink into the card, which means pale on white and dark on
navy. It is wrong for a *physical magnitude* drawn as a continuous field — a stress surface, a
contact patch, a pressure bulb. There the color **is** the quantity, and swapping the ends with the
site theme makes one figure say opposite things in the two themes. The Contact Stress Visualizer
shipped that way: `rampScale('orange', 'dark')` put the deep 900 at `t=0`, so the near-zero haze
around the tire patch came out in strong burnt orange and the peak in pale 100, and anyone reading
saturation as magnitude read the field inside out.

So a field takes `fieldScale(theme)`, which runs **washed at zero → intense at the peak in both
themes**. One hue cannot do that on two surfaces, because "intense" is dark on white and luminous on
navy, so it is a per-theme multi-hue warm ramp cut so that **contrast against its own card rises
monotonically with the value** — the one cue that reads as magnitude on either surface.

| | zero | | | | | peak | vs. card |
|---|---|---|---|---|---|---|---|
| **Field, light** (on `#FFFFFF`) | `#FFE1C0` | `#FCC983` | `#F9A445` | `#F0771B` | `#D5450E` | `#A3160F` | 1.25 → 7.84 |
| **Field, dark** (on `#162033`) | `#2A2E3C` | `#4E3229` | `#7F4420` | `#B35D18` | `#E08A18` | `#F9C24A` | 1.21 → 9.97 |

Still the stress hue of §B4 — the light ramp is the orange ramp opened out through amber and closed
into deep red, the dark one the same path from a near-neutral charcoal up to a luminous amber.
Lightness is monotone in whichever direction its card requires, and chroma climbs with the value
until the sRGB gamut caps it at the last stop. `src/components/react/fieldRamp.test.mjs` asserts all
of it, including that the ends do **not** swap. Named ramps keep the §A4.2 reversal; only fields opt
out. Signed fields are a different problem again and take a diverging scale (§A4.4).

## B6. Plotly binding

Plotly is the rendering engine, so §A7 has to be expressed as trace/layout defaults. These live in
`chartTheme.ts` and **no tool sets them locally**:

```
xaxis / yaxis:  showline: false, ticks: '', zeroline: false, showgrid: <y only>,
                gridcolor: grid/line, griddash: 'dash', nticks: 4,
                tickfont: { family: 'IBM Plex Mono', size: 11.5, color: text/muted }
hovermode:      'x unified' (or 'y unified' for depth profiles) → gives §A6.7's vertical hover line
hoverlabel:     bgcolor bg/surface, bordercolor border/hairline, 12 px radius via CSS,
                font IBM Plex Mono 12, align 'left'
bar traces:     marker.cornerradius 6 (Plotly ≥ 2.27 — we are on 3.4), bargap 0.4, bargroupgap 0.1
legend:         showlegend: false — see below
```

**Deviations, with reasons:**

1. **Legends are HTML, not Plotly.** Plotly renders line-series legend keys as line segments, not
   §A7's 8 px round dots, and cannot align them to the card's padding. We render a `<Legend>` React
   component below the plot (8 px dots, 13 px muted labels, fixed series order) and set
   `showlegend: false`. This also lets the legend double as the series toggle.
2. **Heatmap/contour legends are HTML.** Plotly's `colorbar` cannot be a 6 px fully-rounded
   gradient bar with `Low`/`High` end labels (§8.11), so a `<RampBar>` component renders it and the
   colorbar is hidden.
3. **No per-bar entrance stagger.** §A10's 24 ms stagger is not reachable through Plotly without
   hand-driving frames. We use a single 320 ms `cubic-bezier(0.22,1,0.36,1)` fade-and-rise on the
   chart container, once on mount, gated on `prefers-reduced-motion`. Hover, tooltip, and the
   "no animation on filter change" rules are honored as written.
4. **Rounded stacked-segment gaps** (§A7, 3 px) are not expressible in Plotly stacked bars. Where a
   stack matters (LCA stages, ESAL contributions), use §8.10's *detached* multi-segment composition
   bar rendered as HTML/SVG rather than a Plotly stack.

Anything Plotly cannot express to standard gets rendered as inline SVG/HTML instead of being
downgraded. The standard wins; the library does not.

## B7. Component binding

The existing `cee-*` classes in `src/components/react/tools.css` map onto §A6 as follows. New
shared React primitives live in `src/components/react/ui/` so the standard is enforced by
construction, not by discipline:

| §A component | CEE 406 | Change required |
|---|---|---|
| A6.1 Card | `.cee-chart`, `.cee-panel` | radius 12 → **16**, border → `border/hairline`, shadow → `0 1px 2px rgba(16,24,40,0.04)`, header gains the 17/600 + 13 px subtitle + right affordance structure |
| A6.2 KPI strip | `.cee-keys` / `.cee-key` | label → sentence case 14 px secondary; value → 40/700 tracking −0.03em tabular; columns separated by 1 px vertical hairlines; `--accent` variant keeps the brand left border |
| A6.3 Chips | `.cee-chip` (presets), `.cee-field__unit` | preset chips → 36 px, 999 px radius, control border; unit chips → stat-chip spec on `bg/sunken` |
| A6.4 Buttons | `.cee-btn`, `.cee-btn--primary/ghost` | primary → brand pill 40 px 14/600; ghost icon → 32 px, `bg/hover` on hover |
| A6.5 Table | `.cee-table`, `.cee-tablewrap` | header 12 px muted on `bg/sunken`; rows 56 px, bottom hairline only, no vertical rules; numerics right-aligned tabular |
| A6.7 Tooltip | Plotly `hoverlabel` + `.cee-tip__pop` | both restyled to the one tooltip spec |
| A6.8 Banner | `.cee-warn` | semantic tint bg, no border, 12 px radius, 20 px leading icon, bolded colored spans |
| A8.8 Progress | `.cee-share` | hatched remainder in the same hue, 12 px height, fully rounded |
| A8.17 Object row | `.cee-axle-row` | inline progress + status pill in the row |
| — | **new** `<Legend>`, `<RampBar>`, `<Card>`, `<KpiStrip>`, `<Figcaption>` | see §B6 |

`.cee-flow` (the ESAL factor-by-factor strip) has no §A analog; keep it, restyled to the
stat-chip and hairline tokens.

## B8. Chart-type assignments for this site

Applying §A8.18 to the charts we have and the ones we are adding:

| Where | Today | Standard chart |
|---|---|---|
| Stress/strain/deflection vs. depth | line, heavy grid, 10.5 px | **8.5** gradient area + line, depth on y, ≤ 4 gridlines, HTML legend |
| Pressure bulb σz/p | Plotly contour + colorbar | **8.11**-styled contour, orange ramp, `<RampBar>` legend with Low/High |
| Rutting / cracking vs. N | multi-line | **8.5**, total in `text/primary`, layers in the semantic hues |
| LCA stage totals | horizontal Plotly bar (log scale) | **8.8** row geometry with share-of-total semantics + **8.16** table. The log-scale bar broke §A12's "bars start at zero"; §8.10's composition bar was tried and rejected — it requires the % printed *inside* every segment, which is impossible when one stage is 88 % and the rest are 3–4 %. Rows keep the number in its own column, so they stay readable at any skew |
| Westergaard case comparison | horizontal Plotly bar | **8.2** target-vs-actual layered bars — the modulus of rupture is the ghost/target bar, each case stress the actual, so the chart reads as "how much of the concrete's strength this loading consumes" |
| ESAL axle spectrum | bar | **8.1** paired bars (axles vs. ESAL contribution) |
| Mr parity plot | scatter | scatter + 1:1 reference line, 8 px dots, brand hue |
| Damage layer shares | `.cee-share` inline bars | **8.16** table with an inline micro-bar on the share column — *not* 8.8, whose rows are independent percentages; layer shares sum to 100 % |
| *New:* AASHTO sensitivity (SN vs. R, vs. ESAL) | — | **8.2** target-vs-actual layered bars |
| *New:* drainage time-to-drain | — | **8.5** with a marker line at 95 % drainage |
| *New:* seasonal k / Mr by month | — | **8.11** rounded-cell heatmap |

**Never** a pie for LCA stages or ESAL composition (§A12).

### B8.1 Depth profiles — reading of the gridline rule

Half this toolbox plots a response against **depth**, with `z` on a reversed y-axis and the
quantity on x. §A7's "horizontal gridlines only" was written for time series, where y carries the
value; taken literally it is ambiguous here.

The binding reading: **gridlines run horizontally, along the depth axis, and never on the value
axis.** Two reasons — it keeps the letter of §A7, and it serves what these charts are actually for,
which is comparing σz, εz and w *at the same depth*. Precision comes from the depth probe and the
table, not from counting gridlines, which is the same argument §A7 uses to drop the y-axis when a
KPI already states the magnitude.

## B9. Accessibility carry-overs

§A11 in full, plus the two rules this site already had, which stay:

- Every chart keeps its **table view** — this is the §A11 "never encode by color alone" escape hatch and it is also how students check hand calculations. It is not optional.
- Every input keeps its `Tip` tooltip; every tool keeps its `<details class="cee-howto">` panel and `cee-warn` validation messages.
- Palettes are re-validated with the **dataviz six-checks** per surface (light on `#FFFFFF`, dark on `#162033`) whenever a hue changes. §B4's values are derived from §A3.3 and **must be re-validated before they ship.**
