# Dashboard Visual Language — Repository Instructions

**Scope:** every dashboard, analytics, reporting, and data-visualization surface.
**Status:** authoritative. When this document and an ad-hoc decision conflict, this document wins.
**Companion:** `loaders.md`. The two share the `.elx` scope and the `--elx-*` token prefix, so they compose without conflict. This file is complete on its own.
**Version:** 1.0

> **Repo note.** This site's binding of this system lives in `chart-standards.md` §B, including
> the one naming deviation (`cee-` prefix rather than `elx-`) and its reason. Read both.

---

## 0. How to use this file

Sections 1–9 are the rules. Section 10 contains complete, copy-ready source for two files. Section 11 is the pre-merge checklist.

### 0.1 The integration contract — read this first

This system is **additive to an existing website**. It must never alter the appearance of anything outside a dashboard surface. Every rule below exists to guarantee that, and none is optional:

| Rule | Why |
|---|---|
| **All tokens declared on `.elx`, never on `:root`** | Prevents variable collision with the host site. Descendants inherit through the cascade. |
| **All class names prefixed `elx-`** | No chance of matching an existing site class. |
| **All keyframes prefixed `elx-`** | Keyframe names are global in CSS; unprefixed names clash silently. |
| **No bare element selectors** — no `body`, `h1`, `p`, `*` | A single unscoped `* { box-sizing }` reflows the host site. |
| **Box-sizing scoped**: `.elx, .elx *` only | Same reason. |
| **No `!important`** except inside `prefers-reduced-motion` | `!important` leaks and is unwinnable for the host site. |
| **No `@font-face`, no font imports** | Typography inherits from the host site by default. See §2.1 for the opt-in override. |
| **No CSS reset, no normalize** | The host site already has one. |
| **One stylesheet** (`elx-dashboard.css`), imported once | Everything — tokens, components, chart chrome — lives in it. |

**Usage pattern.** Wrap any dashboard surface in the scope class. Nothing outside it is touched.

```jsx
<div className="elx" data-theme="light">   {/* or "dark", or omit to follow the host */}
  {/* dashboard */}
</div>
```

### 0.2 Files this document defines

| File | Contents | Section |
|---|---|---|
| `elx-dashboard.css` | Tokens (light + dark), layout, cards, KPI strip, chips, buttons, tables, chart chrome and mark primitives | §10.1 |
| `elx-theme.js` | Palettes, ramps, color utilities, chart-library defaults, SVG defs, formatters | §10.2 |

If your build prefers fewer modules, `elx-theme.js` may be merged into a components file. The CSS must stay a single file.

---

## 1. Design thesis

Off-white page. White cards with a hairline border and near-zero shadow. Generous radii. A geometric-humanist sans with tight tracking on numerals. Charts stripped of every piece of chrome that is not load-bearing. **Color does the semantic work.**

Each product picks **one brand hue** that owns the UI, then either expands it into a **monochrome ramp** for ordered data, or switches to a **fixed categorical set** for unordered data.

The distinguishing move — and the thing that separates this from a template — is that **marks are treated as rounded physical objects**: pills, capsules, hexes, dot stacks, ticks. Not rectangles. Texture (45° hatch, vertical gradient fade, ghost tracks) encodes a *second* variable — target, remainder, forecast — never decoration.

### The twelve rules

1. Page is off-white; every content block is a white card with a 1 px hairline border and no or near-zero shadow.
2. Radii are aggressive: cards 16 px, chips 8 px, heatmap cells 8 px, bar caps 6 px.
3. One brand hue per product. It appears in primary buttons, the primary data series, progress fills, and active-tab underlines — **not** in nav active states or body text.
4. Ordered data → monochrome ramp. Unordered data → categorical hues. Never mix both in one chart.
5. No axis lines, no ticks, no plot border. Horizontal gridlines only, ≤ 5, dashed or ultra-light.
6. Drop the y-axis whenever the magnitude is already stated in the KPI above the chart.
7. Legends go **below** the plot, 8 px round dots, 13 px muted labels.
8. Every card header is `title` + a right-side affordance (`···`, a chip, or a select).
9. Deltas are always `arrow + colored % + gray context phrase`. Green up, red down, no colored background.
10. Stacked segments carry a 2–3 px gap and their own corner radius.
11. Bars start at zero. Always. (Lines need not.)
12. Reading order is enforced: KPI strip → primary trend → distribution → tables last.

---

## 2. Typography

### 2.1 Faces

By default the system **inherits the host site's font stack**. Do not import fonts.

Opt in per-surface only if the host face is unsuitable for data — no tabular figures, or a display face too wide for numerals — by setting `--elx-font-display` and `--elx-font-body` on the `.elx` wrapper. Recommended in that case: **General Sans** or **Aeonik** for display and KPI numerals, **Inter** or **Geist** for UI and body.

Never introduce a serif. Never introduce a mono face except for IDs, hashes, and code. Data and tables always use `font-variant-numeric: tabular-nums`.

### 2.2 Scale

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-kpi` | 40 / 44 | 700 | −0.03em | Hero metric (`$589`, `98.4%`) |
| `metric-lg` | 32 / 38 | 600 | −0.02em | Card metric (`250`, `$18,420`) |
| `metric-md` | 23 / 28 | 600 | −0.02em | Inline metric |
| `title-page` | 26 / 32 | 600 | −0.02em | Page title |
| `title-card` | 17 / 24 | 600 | −0.01em | Card header |
| `subtitle` | 14 / 20 | 400 | 0 | Gray card sub-caption |
| `body` | 15 / 22 | 400–500 | 0 | Rows, table cells |
| `label` | 13 / 18 | 500 | 0 | Legends, KPI labels |
| `caption` | 12 / 16 | 500 | 0 | Axis ticks, deltas, chips |
| `eyebrow` | 11 / 14 | 600 | +0.06em, uppercase | Sidebar section headers |

### 2.3 Rules

- KPI values are the only place tracking goes below −0.02em.
- Axis ticks: 12 px, muted, weight 500. **Never bold, never rotated.** If labels would need rotating, reduce the tick count or switch chart orientation (§7.7).
- Numbers in tables and legends: tabular, right-aligned. Symbol attached (`$7.84`, `98.4%`).
- Card titles are sentence case. Eyebrows are uppercase. **No title case anywhere.**
- Use the 14 px muted sub-caption under a card title to carry the encoding explanation that the stripped chart chrome no longer provides — e.g. "Geographic intensity by time of day and region". This is not optional garnish; it is where the removed axis labels went.

---

## 3. Layout

### 3.1 Shell

| Shell | Sidebar | When |
|---|---|---|
| Left rail + content | 240–280 px | ≥ 8 destinations |
| Top nav + content | — | ≤ 8 destinations; active item is a white pill with a soft shadow on a gray track |

**Left rail.** White or 1–2 % darker than the page, separated by a 1 px right border — never a shadow. Top: 32 px rounded-square logo tile + wordmark + a 32 px collapse button. Uppercase eyebrows group destinations. Item = 20 px outline icon + 15 px label, 40 px row, 10 px gap, 10 px horizontal padding.

**Active state is a neutral 4 % tint pill (10–12 px radius), not brand-colored** — brand color is reserved for data and primary actions.

Sub-items indent 28 px on a 1 px vertical hairline with short horizontal ticks; the icon is dropped at sub-level. Badges right-aligned: brand-tinted for actionable counts, gray for informational. Footer block after a top hairline; destructive links in red.

### 3.2 Top bar

Page title left (26/600). Right, in order: primary AI action (black or brand pill with a sparkle glyph), a divider, 36 px circular ghost icon buttons (search, help, notifications with a 6 px dot), then the account chip (24 px avatar + name + `chevrons-up-down`). Height 64–72 px, bottom hairline, no shadow.

### 3.3 Control row

Directly under the title, 36–40 px tall, 8–12 px gaps.

- **Select pill:** white, 1 px border, 999 px or 10 px radius, leading 16 px icon, label, trailing chevron.
- **Add filter:** `+` glyph + label, same pill.
- **Segmented control:** gray track; active = white pill with a 1 px border and a very soft shadow. A status dot may sit inside a segment.
- **Tabs:** text-only, 15 px, active = full-strength text with a 2 px underline flush to the row's bottom border; inactive muted.
- **Use tabs for *views*, segmented controls for *filters*.**
- Right-aligned secondary action with a leading icon.

### 3.4 Grid & proportions

- 12 columns, 24 px gutter, 28 px page padding, content max-width 1560 px.
- 8 pt vertical rhythm. Card gap 24 px.
- Canonical splits: `12` (KPI strip), `8/4`, `6/6`, `4/4/4`, `7/5`.
- Card heights: KPI strip 150–180 px; chart card 360–420 px; list/table card 460–560 px. Plot height 240–300 px after header, legend, and padding.
- Plot aspect between 16:9 and 2:1. Never taller than wide except for horizontal-category charts.
- **Reading order is enforced:** KPI strip → primary trend → distribution/secondary → tables and lists last.

### 3.5 Responsive

| Breakpoint | Behavior |
|---|---|
| ≥ 1100 px | Full 12-column grid, sidebar visible |
| < 1100 px | Sidebar collapses to a drawer; `4/5/7/8` columns all become half-width |
| < 720 px | Every card is full width; KPI strip becomes a 2-column grid with no vertical rules; page padding 16 px; KPI value drops to 32 px |

Charts reflow rather than scroll horizontally. If a chart cannot survive the narrow breakpoint, reduce the category count for that breakpoint — do not shrink the bars below 10 px.

---

## 4. Color

### 4.1 Neutrals — light

| Token | Hex | Use |
|---|---|---|
| `bg-page` | `#F7F8F8` | App background |
| `bg-surface` | `#FFFFFF` | Cards |
| `bg-sunken` | `#F2F4F5` | Nested card, segmented track, table header |
| `bg-hover` | `#F5F6F7` | Row / nav hover |
| `border-hairline` | `#ECEDEF` | Card border, dividers |
| `border-control` | `#DFE2E5` | Input / select borders |
| `grid-line` | `#F0F1F3` | Solid gridlines |
| `grid-line-dash` | `#E4E7EC` | Dashed gridlines |
| `track-ghost` | `#EDEFF1` | Empty portion of progress / target bars |
| `dot-grid` | `#E4E7EC` | Dot-matrix background |
| `hex-empty` | `#EEF0F2` | Empty hexbin cells |
| `text-primary` | `#101418` | Headings, values |
| `text-secondary` | `#5B6670` | Body, sub-captions |
| `text-muted` | `#98A2AC` | Axis ticks, placeholders |

Card shadow: `0 1px 2px rgba(16,24,40,0.04)` **maximum**. Elevated (tooltip, dropdown, active segment): `0 8px 24px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)`.

### 4.2 Brand hue — pick one per product

| Name | Base | Wash | Deep (hover) |
|---|---|---|---|
| Emerald | `#12A57F` | `#E6F7F1` | `#0B7A5D` |
| Orange | `#F26A1B` | `#FEF0E7` | `#C2500F` |
| Rose | `#EC3E76` | `#FDECF2` | `#BE2557` |
| Blue | `#2563EB` | `#EAF0FE` | `#1D4FD7` |

Set by overriding `--elx-brand`, `--elx-brand-wash`, `--elx-brand-deep` on the `.elx` wrapper. Nothing else needs to change.

### 4.3 Categorical palette — unordered series, max 6

| # | Name | Light | Dark |
|---|---|---|---|
| 1 | Blue | `#3B9BF0` | `#5AAEF5` |
| 2 | Emerald | `#14B489` | `#2FC79C` |
| 3 | Amber | `#F5B62E` | `#F7C64F` |
| 4 | Orange | `#F26A22` | `#F98244` |
| 5 | Pink | `#F0388B` | `#F5619F` |
| 6 | Violet | `#8B5CF6` | `#A78BFA` |

**Assign strictly by series index, 1 → 6 — never by data value.** A series must keep its color across every chart in the product and across every re-render. Five hues is the practical ceiling before the legend becomes work; six only when unavoidable.

### 4.4 Sequential ramps — ordered, stacked, heatmap

5 steps, listed high → low (light mode).

| Ramp | 900 | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| Emerald | `#0B7A5D` | `#12A57F` | `#34C79E` | `#8FE0C6` | `#E4F7F1` |
| Orange | `#8A3D0B` | `#C2410C` | `#EA580C` | `#FB923C` | `#FED7AA` |
| Blue | `#12447F` | `#1B67C4` | `#3B9BF0` | `#93C6F8` | `#E4F0FD` |
| Rose | `#8E1E45` | `#BE2557` | `#EC3E76` | `#F693B4` | `#FDE7EE` |
| Neutral | `#3F474E` | `#6B757E` | `#98A2AC` | `#CBD2D8` | `#EDEFF1` |

Heatmaps interpolate the ramp **continuously** and always ship a gradient legend bar with `Low` / `High` end labels. Never a diverging or rainbow scale unless the measure has a true midpoint.

### 4.5 Semantic

| Token | Hex | Wash (light) | Use |
|---|---|---|---|
| `positive` | `#12B76A` | `#E6F7EF` | Up deltas, on target |
| `negative` | `#E5484D` | `#FDECEC` | Down deltas, At Risk |
| `warning` | `#F59E0B` | `#FEF3E2` | In progress, pending risk |
| `info` | `#3B9BF0` | `#E8F3FE` | Neutral notice |
| `neutral` | `#98A2AC` | `#F2F4F5` | Pending, disabled |

Applied as **text + icon on a wash background** for pills, and **text + icon only** for deltas. Never a saturated fill behind white text at these sizes. Never on a loader.

---

## 5. Dark mode

Dark mode is **not an inversion** — it is a re-derivation with four transformations.

### 5.1 Surfaces

| Token | Dark value |
|---|---|
| `bg-page` | `#0C0E10` |
| `bg-surface` | `#151719` |
| `bg-sunken` | `#101214` |
| `bg-hover` | `#1C1F22` |
| `bg-elevated` | `#1E2225` |
| `border-hairline` | `rgba(255,255,255,0.07)` |
| `border-control` | `rgba(255,255,255,0.12)` |
| `grid-line` | `rgba(255,255,255,0.06)` |
| `track-ghost` | `rgba(255,255,255,0.07)` |
| `text-primary` | `#F2F4F5` (never pure white) |
| `text-secondary` | `#9BA4AC` |
| `text-muted` | `#6C767E` |

**`bg-sunken` is darker than the card, not lighter.** Elevation in dark mode is expressed by surface lightness, not shadow — card shadow becomes `none`; only tooltips and dropdowns keep a shadow, and a heavier one.

### 5.2 Data hues

- **+8–12 % lightness, −8–12 % saturation.** Saturated mid-tones vibrate on black.
- Minimum contrast against `bg-surface`: **3:1** for a filled shape, **4.5:1** for a 1–2 px line or a text label.
- Sequential ramps keep the same hue and the same 5 stops, but **reverse which end reads as "low"**: light mode runs dark→light with light as empty; dark mode runs light→dark with dark as empty. `rampScale()` in §10.2 normalizes this so `t=0` is always low in both themes.

### 5.3 Brand hue

Hover reverses direction. In light mode hover goes **darker**; in dark mode it goes **lighter**. The wash becomes a low-alpha version of the hue rather than a solid pastel:

```
--elx-brand:      #2FC79C   /* was #12A57F */
--elx-brand-deep: #6FE0BE   /* hover: lighter, not darker */
--elx-brand-wash: rgba(47,199,156,0.14)   /* replaces #E6F7F1 */
```

### 5.4 Textures and fades

- Gradient area fills fade to **`transparent`**, never to a color. In light mode this lands on white, in dark on `#151719` — the same code, the correct result.
- Diagonal hatch always *removes* light from the fill, so it inverts: light `rgba(255,255,255,0.30)`, dark `rgba(0,0,0,0.30)`.
- Ghost / target bars and dot grids move to low-alpha white.

---

## 6. Components

### 6.1 Card

```
radius 16px · bg-surface · 1px hairline · padding 22px
header: title(17/600) [+ subtitle(14, secondary)]  ······  affordance
optional hairline under header (when the body is a metric strip)
body
```

The affordance is one of: `···` overflow in a 32 px rounded-square ghost button; a `Filter` chip; a select pill; a stat chip; a text link with a trailing arrow ("View full report →").

### 6.2 KPI strip

Full-width card, header row, hairline, then **N equal columns separated by 1 px vertical hairlines**.

```
label   14, secondary
value   40/700, primary, tracking −0.03em, tabular
delta   ↑ 8.3% [positive] + " from last week" (13, muted)
```

Variant: nested cards on `bg-sunken` with 12 px radius, when the metrics belong to two groups that need a visual break.

At < 900 px the strip becomes a 2-column grid and the vertical rules are dropped.

### 6.3 Chips & pills

| Type | Spec |
|---|---|
| Filter / select pill | 36 px, 999 px radius, white, 1 px control border, icon + label + chevron |
| Stat chip | 28 px, 8 px radius, `bg-sunken`, 12 px caption |
| Status pill | 26 px, 8 px radius, semantic wash + semantic text, 12/600 |
| Meta chip | 24 px, 6 px radius, `bg-sunken`, 16 px leading icon + value |
| Keyboard hint | 20 px square, 6 px radius, `bg-sunken`, 11 px |

### 6.4 Buttons

- **Primary:** solid `#101418` or solid brand, 999 px or 10 px radius, 40 px, 14/600, optional leading icon. Black reads "system / AI action"; brand reads "commit this object".
- **Secondary:** white, 1 px control border, same geometry.
- **Ghost icon:** 32–36 px square or circle, no border at rest, `bg-hover` on hover.
- **Icon-only accent:** 40 px rounded-square (10 px radius) in brand with a white glyph — for the single create action.

### 6.5 Table

Header 12–13 px muted weight 500, bottom hairline, **no vertical rules**. Rows 56–64 px with bottom hairline, `bg-hover` on hover, **no zebra striping**. First column is identity (icon or avatar + name + meta chips underneath). Numeric columns right-aligned, tabular. Progress and status render **inline in the row**, not in a drawer. Trailing `···` column, 40 px. Leaderboard variant adds a leading 40 px rank column in muted 14/600.

### 6.6 Ranked list

Each row is **its own bordered card** (12 px radius, 1 px hairline, 8 px vertical gap) — not a table. Circular 24 px rank badge on `bg-sunken`, 24 px logo, 15/500 name, optional trailing metric. The header may carry a two-tab switcher.

### 6.7 Tooltip

Surface (dark: `#1E2225`), 12 px radius, 12–14 px padding, elevated shadow, **no arrow**.

```
Category title (13/600)
● Series label            value    ← 8px dot, label secondary, value primary right tabular
```

Triggered by a **vertical hover line** in time series; the intersected point gets a 7 px filled dot with a 2 px surface-colored ring.

### 6.8 Banner

Full-width, 12 px radius, semantic wash background, **no border**. Leading 20 px icon, message with **bolded colored spans** on the key nouns, trailing white outline button. One per page, maximum.

### 6.9 Iconography

Outline / stroke, 1.5–1.75 px, rounded caps and joins, 24 px optical grid. **Lucide** is the reference set; Phosphor Regular is the alternative.

Sizes: 16 px inline and chips, 18 px table rows, 20 px navigation, 24 px card-header feature icons. Icons inherit text color — `text-secondary` at rest, `text-primary` when active. **A colored icon means it encodes data**, not decoration.

- **Feature icon tile:** 36–40 px rounded-square (10 px radius), background = hue at 10–12 % wash, icon in the full hue. One per card header or status card.
- **AI glyph:** a four-point sparkle marks every AI-driven affordance. Reserved — do not spend it elsewhere.
- **Status dots:** 6–8 px filled circles. Legend dots 8 px with an 8 px gap to the label.
- **Delta arrows:** either a bare `arrow-up`/`arrow-down` in the semantic color, or a 16 px filled circle with a white arrow. Pick one treatment per product and keep it.
- **Avatars:** 28–36 px circles in lists, 32 px in tables, 48–56 px on a podium chart. Letter-mark fallback = 8 px rounded square, hue wash background, hue letter.

---

## 7. Chart chrome

| Element | Rule |
|---|---|
| Plot border | None |
| Axis lines / ticks | None — no domain line, no tick marks |
| Y gridlines | Horizontal only, 1 px, ≤ 5 lines. Solid `grid-line`, or dashed `4 3` at `grid-line-dash` |
| X gridlines | Only on matrix / cell grids, as dashed cell separators |
| Y axis labels | Omit when the magnitude appears in a KPI or on the marks. When kept: 12 px muted, 3–5 values, unit on the top label only or in the subtitle |
| X axis labels | 12 px muted, horizontal, abbreviated (`Jan`, `Sun`, `6AM`). Thin to every 2nd or 3rd rather than rotating |
| Legend | Below the plot, 16 px above the card's bottom padding, 8 px dots, 13 px muted, 20 px gaps. Centered for 2 series, left-aligned for 3+ |
| Zero baseline | Implied by the lowest gridline; never a heavier rule |
| Direct labels | Preferred over a legend for ≤ 3 categories in composition bars |
| Annotation | A single vertical `now` line (1 px `border-control`) with a dot marker is the **only** permitted in-plot annotation |

### 7.1 Bar geometry defaults

- Category padding 0.35–0.45 — bars occupy ~60 % of the band.
- Intra-group padding 0.08–0.12 for paired bars.
- Corner radius `min(6px, barWidth/3)` on the value end only; both ends for floating and range bars.
- Stacked segments: 2–3 px gap, and **each segment keeps its own radius**.
- Minimum bar width 10 px, maximum 64 px. **Cap the category count before you thin the bars.**

### 7.2 Texture recipes

- **Hatch:** 45°, 1.5 px lines, 6 px pitch. Light `rgba(255,255,255,0.30)`, dark `rgba(0,0,0,0.30)`.
- **Gradient:** fades toward the **baseline**, never toward the value end, and fades to `transparent` so the same code works in both themes.
- Opacity floors: filled marks ≥ 0.85; supporting marks 0.20–0.30; decorative 0.30–0.45.
- **One texture per card.** Hatch and gradient may coexist on one mark; hatched bars and dot-matrix columns may not coexist on one card.
- **Hatch encodes "projected / remaining / not-yet-real". Solid encodes actual.** This is a semantic assignment, not a style choice — do not use hatch decoratively.

### 7.3 Motion

- Entrance: bars grow from the baseline, 320 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, 24 ms stagger by category. Lines draw left→right over 500 ms. **Once on mount only** — on filter change, re-render with a 220 ms value tween instead.
- Hover: 120 ms on opacity and fill only. Non-hovered series drop to 35 % opacity.
- Tooltip: 100 ms fade + 4 px translate, no scale.
- Number transitions: tween the value, not the opacity, 400 ms.
- Respect `prefers-reduced-motion: reduce` — disable entrance and draw animations, keep the 120 ms hover feedback.

---

## 8. Chart catalog

Eighteen encodings. Each: what it is → when → spec.

### 8.1 Paired grouped bars
Two series per category, side by side, same hue at two lightnesses.
**Use for** generated vs. converted, planned vs. actual, this year vs. last — where both series share a unit and one is a subset or successor of the other.
**Spec** bar width 26–34 px, 4 px intra-pair gap, 6 px top radius, 3 gridlines, **no y-axis**, legend centered below. Light member always left.
**Not for** more than two members per group — use stacked or small multiples.

### 8.2 Target-vs-actual layered bars
A pale ghost bar (target or previous period) behind a shorter saturated gradient bar (actual). One bar may be fully saturated to mark the max or the selection.
**Use for** attainment against a benchmark without a second axis or a second chart.
**Spec** ghost = `track-ghost` or brand at 8 %, optionally hatched above the actual. Actual = vertical gradient from the hue fading to ~20 % alpha at the baseline. Same width and x-position; ghost drawn first; both 6 px rounded.
**KPI-card variant** drop labels and gridlines, bleed to the card edges at 40 % opacity, `aria-hidden`.

### 8.3 Stacked columns, monochrome ramp
5 segments per column in one hue's 5-step ramp, darkest at the base, 3 px gaps, rounded corners on every segment, diagonal hatch inside, palest segment on top reading as "remaining / other".
**Use for** composition of an *ordered* set across time — teams by seniority, funnel stages, cost tiers.
**Spec** ≤ 12 categories on x. Segment radius 4 px, gap 3 px. Legend below in ramp order. Tooltip lists all segments with values right-aligned.
**Why a ramp, not categories** the eye reads a ramp as ordered, so the stack order becomes self-documenting. Use categorical hues here only if the segments genuinely have no order.

### 8.4 Segmented pill columns with whiskers
Each x-category is a column of **detached rounded capsules**, one per series, whose height encodes the value; thin stems with terminal dots extend above the top and below the bottom capsule; a faint dashed cell grid sits behind.
**Use for** 4–6 sources across 7–14 time buckets, where you want per-series magnitude *and* a sense of the total envelope, without the misreading a true stack invites.
**Spec** capsule 44–56 px wide, 10 px radius, min height 24 px, 8–10 px vertical gap. Series order fixed top→bottom and **never re-sorted**. Stem 1.5 px in the adjacent capsule's hue, terminal dot 5 px. Categorical palette, legend below.
**Caution** capsules do not sum to a meaningful total — never label it as stacked, and never give it a y-axis.

### 8.5 Gradient area + line with forecast
A 2 px line over an area filled with a vertical gradient fading to transparent; a 1 px vertical `now` line with a filled dot at the intersection; beyond it the line continues as a dotted projection.
**Use for** a single continuous metric over time with a forecast or a "today" split.
**Spec** line 2 px, round joins and caps, `monotoneX` — never a hard spline that overshoots. Gradient hue 22 % → 0 %. Forecast: same hue, `dasharray 2 4`, 60 % opacity, area fill drops to 8 %. Marker 7 px dot with a 2 px surface ring.

### 8.6 Micro-histogram baseline
A row of very short pale bars along the x-axis beneath an area chart, encoding a secondary count.
**Use for** adding volume context under a rate or price line without a second axis.
**Spec** occupies the bottom 15–18 % of the plot, hue at 25 % opacity, 3 px radius, shares the x-scale exactly. Gets a legend entry but no axis.
**Limit** keep it decorative in magnitude. If the reader needs to compare its values, it deserves its own card.

### 8.7 Horizontal range bars with whiskers
Per category, a floating two-tone horizontal bar (saturated = current, pale = range or change) with 1.5 px whiskers ending in 4 px dots.
**Use for** distributions or before→after ranges across 4–8 named stages — duration, price band, score spread.
**Spec** bar height 26–32 px, fully rounded at the outer ends, square at the internal split. Whisker in `border-control`, terminal dot in the base hue. Category labels left in a fixed 80–110 px gutter, 14 px secondary. X gridlines omitted; the scale goes in the subtitle.
**This is the correct chart when categories are few and labels are long** — it eliminates the rotated-label problem outright.

### 8.8 Progress bar with hatched remainder
Label above, % right-aligned; a bar whose filled portion is solid and whose remainder is a **hatched tint of the same hue** rather than gray.
**Use for** 3–6 *independent* percentages, where each row is its own 100 %.
**Spec** height 12–14 px, fully rounded. Fill = brand base. Remainder = brand at 12 % with 45° hatch at 20 %. 20 px row gap. Value 15/600 right, label 14/500 left.

### 8.9 Ticked "equalizer" bar
A progress bar rendered as ~50 discrete 2 px vertical ticks; filled ticks in the category hue, empty ticks in `track-ghost`.
**Use for** scores and competency ratings, where the visual should suggest *granularity and measurement*. Deliberately distinct from 8.8 so both can coexist on one page.
**Spec** tick 2 px wide, 2 px gap, 14 px tall, 1 px radius. One hue per row from the categorical set in index order. % right-aligned 15/600.

### 8.10 Multi-segment composition bar
A single horizontal bar broken into 3–5 **detached** rounded segments, each its own hue, each with an inline % chip at its left edge, each fading left→right.
**Use for** a cost or traffic breakdown of exactly one total.
**Spec** segment height 28 px, 8 px radius, 8 px gap, widths proportional to share. Gradient hue 100 % → 12 %. Inline chip: hue wash background, hue text, 11/600, 4 px radius. Legend with dots below.
**Note** the gaps mean this is not a precise part-to-whole read — acceptable only because the % is printed on every segment.

### 8.11 Rounded-cell heatmap
Matrix of rounded rectangles, rows = category, columns = bucket, color = sequential ramp.
**Use for** two categorical dimensions against one intensity measure.
**Spec** cell ~56 × 44 px or fluid, 8 px radius, **6 px gap** — the gap is what stops it reading as a spreadsheet. Ramp interpolated continuously; the lowest step must remain visible against the card, never pure white. Row labels left 14/500 secondary; column labels below 12 px muted, thinned to every other. **Always** ship a continuous gradient legend bar (6 px tall, fully rounded, 160–220 px wide) with `Low` / `High` labels.

### 8.12 Hexbin / honeycomb composition
A cluster of hexagons, each one unit of contribution, colored by category, arranged in an organic blob with pale empty hexes filling the field.
**Use for** part-to-whole with a **countable unit** — one hex = $X, or 1 person, or 1 % — across 3–5 categories, where the composition should feel physical and roughly countable.
**Spec** hex radius 10–14 px, 2 px gutter, pointy-top. Categorical hues at 100 %; empty cells `hex-empty`. Sort so the largest category forms the outer ring and smaller ones cluster centrally — this reads as nested rather than random. Below the plot: a legend **list**, one row per category with dot + label + share chip + value with a semantic delta arrow.
**Cost** expensive to read precisely. Only use when the adjacent list carries the exact numbers.

### 8.13 Dot-matrix column chart
Each column is a stack of small filled dots on a background field of pale dots; column height is quantized to the dot grid.
**Use for** a daily or weekly series where the metric is countable and the visual should feel unit-based — sessions, posts, orders, dollars in fixed increments.
**Spec** dot 4–5 px, 3 px pitch on both axes. Background dot grid covers the full plot in `dot-grid`. Filled dots in a single hue, no gradient. Y-axis labels only, 4 steps, unit on every label since the grid replaces gridlines. X shows a single anchor label rather than a full tick set.
**Constraint** quantization error must be ≤ 1 dot at the smallest column — pick the dot's value from the data range, not from the pixel grid.

### 8.14 Podium bar chart
Three bars in 2nd–1st–3rd order, an avatar floating above each, the rank word inside the bar, a white % pill at the foot. Distinct vertical gradients with diagonal hatch.
**Use for** exactly three top performers. A display object, not an analysis chart.
**Spec** equal widths (~120 px), heights proportional with a **0.65 floor** so 3rd place stays legible. 12 px radius on the top corners only. Gradients pale→mid of three *different* hues — the one place categorical hues encode a ranked quantity, permissible only because the rank is printed. Avatar 52 px with a 3 px surface ring, 16 px above the bar. % pill white, fully rounded, 15/600.

### 8.15 Decorative KPI background chart
A chart at 30–45 % opacity behind or below a headline number, bleeding to the card edges, with no labels, no axis, no legend.
**Use for** giving a KPI card a sense of trend without asking the reader to decode it.
**Spec** no interactivity, `aria-hidden="true"`, gradient fading toward the card floor, 100–140 px tall.
**Test** if a reader would ever need a value from it, this is the wrong pattern.

### 8.16 Leaderboard table
Rank + avatar + name, then 3–5 right-aligned numeric columns. The card carries a subtitle stating the population ("Efficiency score ranking across 25+ drivers") and a filter chip.
**Spec** 64 px rows, hairline dividers, no zebra, hover tint. Rank in muted 14/600. Optional inline micro-bar behind the primary metric at 10 % hue — **one column only**.

### 8.17 Object-row table with inline progress and status
Name + meta chips, owner avatar + name, an inline progress bar, a status pill, a `···` menu.
**Spec** progress bar 8 px tall, fully rounded, hatched brand fill on `track-ghost`, fixed 180 px column. Status pills use the §4.5 washes. Meta chips sit on a second line under the name at 12 px. Header carries a "View all →" link.

### 8.18 Selection guide

| Question | Chart |
|---|---|
| One metric over time | 8.5 area + line; 8.13 dot-matrix if countable |
| Two comparable series over time | 8.1 paired bars |
| Actual against a target | 8.2 layered bars |
| Composition over time, ordered parts | 8.3 stacked ramp |
| Several sources over time, no meaningful total | 8.4 pill columns |
| Composition of one total | 8.10 segment bar; 8.12 hexbin if unit-countable |
| Independent percentages, few rows | 8.8 hatched progress; 8.9 ticks for scores |
| Distribution or range per named stage | 8.7 horizontal range bars |
| Two categorical dimensions × intensity | 8.11 heatmap |
| Rank of entities | 8.16 leaderboard; 8.14 podium only for a top-3 showcase |

---

## 9. Accessibility & anti-patterns

### 9.1 Accessibility

1. Text on wash backgrounds clears **4.5:1**. Every semantic wash/text pair in §4.5 does.
2. Chart hues clear **3:1** against the card surface as filled shapes. Re-verify after any dark-mode change.
3. **Never encode by color alone.** Pair with position (fixed legend order), direct labels, or shape.
4. The 6-hue categorical set is distinguishable under deuteranopia **only if live series are capped at 4** in a single chart. Beyond 4, add direct labels.
5. Every chart needs an accessible name and a text alternative — the card subtitle, or a visually-hidden caption stating the takeaway ("Delivery density peaks 11AM–3PM across all regions").
6. Focus rings: 2 px brand outline with a 2 px offset, on every interactive chart element and control.
7. Minimum 24 × 24 px hit target — use an invisible overlay rect per category band, not the mark itself.
8. Respect `prefers-reduced-motion: reduce` (§7.3).

### 9.2 Anti-patterns

- Pie and donut charts. 8.10 and 8.12 replace them.
- 3D, bevels, or drop shadows on data marks.
- Dual y-axes. Use 8.6, or stack two cards.
- Rainbow or spectral scales for sequential data.
- Rotated axis labels — switch orientation instead.
- Colored card backgrounds. Only banners get a wash.
- Gridlines heavier than 1 px, or vertical gridlines on a time series.
- More than 6 categorical series, or re-ordering series color by value between renders.
- Truncated y-axis on a bar chart.
- The brand hue used simultaneously for a data series and a UI control inside the same card.
- Zebra striping in tables.
- Hatch used decoratively rather than to mean "not-yet-real".
- Title case anywhere.

---

## 10. Source

The complete, copy-ready source for `elx-dashboard.css` and `elx-theme.js` is maintained with
this document. **This repo does not ship those two files** — it implements the same system in
`src/components/react/tools.css` and `src/components/react/chartTheme.ts` under the `cee-`
prefix, for the reason given in `chart-standards.md` §B10. The mapping is one-to-one:

| §10 source | This repo |
|---|---|
| `elx-dashboard.css` tokens | `tools.css` token block on `.cee-tool` |
| `elx-dashboard.css` components | `tools.css` `.cee-card`, `.cee-kpis`, `.cee-table`, … |
| `elx-theme.js` `CATEGORICAL` | `chartTheme.ts` `HUES` / `HUE_ORDER` |
| `elx-theme.js` `RAMPS` / `rampScale()` | `chartTheme.ts` `RAMPS` / `rampScale()` |
| `elx-theme.js` `chrome()` | `chartTheme.ts` `axis()` / `gridAxis()` / `baseLayout()` |
| `elx-theme.js` `svgDefs()` | `chartTheme.ts` `areaFill()` + the `.cee-progress` hatch in CSS |
| `elx-theme.js` `fmt` | `chartTheme.ts` `fmt` / `num` |

When adding a new surface, take the rules from §§1–9 and the implementation from the repo
files above. If you ever extract this system into a standalone package, restore the `elx-`
naming and the `.elx` scope wholesale.

---

## 11. Pre-merge checklist

**Integration**
- [ ] All tokens declared on the scope class, none on `:root`
- [ ] All classes and keyframes prefixed
- [ ] No bare element selectors, no reset, no `@font-face`
- [ ] No `!important` outside `prefers-reduced-motion`
- [ ] Still exactly one stylesheet

**Structure**
- [ ] Page `bg-page`, cards `bg-surface` + hairline, radius 16 px
- [ ] Card header: 17/600 title, optional 14 px subtitle, right-side affordance
- [ ] Reading order: KPI strip → trend → distribution → tables
- [ ] Card heights and plot heights within the §3.4 ranges
- [ ] Responsive behavior verified at 1100 px and 720 px

**Charts**
- [ ] No plot border, no axis lines, ≤ 5 horizontal gridlines
- [ ] Y-axis dropped if the magnitude is stated elsewhere on the card
- [ ] No rotated axis labels anywhere
- [ ] Bars rounded, ≥ 10 px wide, start at zero, stacked segments gapped 3 px
- [ ] One hue ramp for ordered data; fixed categorical index order for unordered
- [ ] Series color stable across charts and across re-renders
- [ ] Legend below, 8 px dots, 13 px muted labels
- [ ] Tooltip: category title + dot/label/value rows, tabular figures
- [ ] Gradients fade toward the baseline and to `transparent`
- [ ] Hatch used only to mean "projected / remaining", one texture per card
- [ ] Card subtitle carries the encoding explanation where chrome was removed

**Typography & color**
- [ ] Delta = arrow + semantic % + gray context phrase
- [ ] Tabular figures in every table, legend, and KPI
- [ ] Sentence case titles, uppercase eyebrows, no title case
- [ ] Brand hue absent from nav active states and body text

**Dark mode**
- [ ] Surfaces re-derived, `bg-sunken` darker than the card
- [ ] Card shadow removed; elevation carried by surface lightness
- [ ] Brand hover goes lighter, not darker
- [ ] Ramp direction re-mapped (verify `rampScale(t=0)` still reads as low)
- [ ] Hatch inverted to black strokes

**Accessibility**
- [ ] Chart hues clear 3:1 as fills; wash/text pairs clear 4.5:1
- [ ] Nothing encoded by color alone; ≤ 4 live series without direct labels
- [ ] Every chart has an accessible name and a text alternative
- [ ] Focus rings present; hit targets ≥ 24 × 24 px
- [ ] `prefers-reduced-motion` disables entrance and draw animations
