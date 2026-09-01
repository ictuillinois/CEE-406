# Loader & Loading-State System — Repository Instructions

**Scope:** every loading, pending, streaming, and progress state in the application.
**Status:** authoritative. When this document and an ad-hoc decision conflict, this document wins.
**Companion:** `dashboard-visual-language.md`. The two share the `.elx` scope and the `--elx-*` token prefix, so they compose without conflict. This file is also complete on its own — every token it needs has a hardcoded fallback.
**Version:** 1.0

> **Repo note.** This site currently ships no loading states: every tool computes synchronously
> in the browser and the only async step is Plotly's dynamic import. §7 below is therefore
> forward-looking guidance rather than a description of shipped code — with one exception worth
> acting on, noted at the end of §7.3.

---

## 0. How to use this file

Sections 1–7 are the rules. Section 8 contains complete, copy-ready source for two files. Section 9 is the pre-merge checklist.

### 0.1 The integration contract — read this first

This system is **additive to an existing website**. It must never alter the appearance of anything outside a surface that opts in. Every rule below exists to guarantee that, and none is optional:

| Rule | Why |
|---|---|
| **All tokens declared on `.elx`, never on `:root`** | Prevents variable collision with the host site. Descendants inherit through the cascade. |
| **All class names prefixed `elx-`** | No chance of matching an existing site class. |
| **All keyframes prefixed `elx-`** | Keyframe names are global in CSS; unprefixed names clash silently. |
| **No bare element selectors** — no `body`, `p`, `*` | A single unscoped `* { box-sizing }` reflows the host site. |
| **Box-sizing scoped**: `.elx, .elx *` only | Same reason. |
| **No `!important`** except inside `prefers-reduced-motion` | `!important` leaks and is unwinnable for the host site. |
| **No `@font-face`, no font imports, no reset** | Typography inherits from the host site. |
| **Every token has a fallback**: `var(--elx-x, #hex)` | The file works standalone and composes when the dashboard file is also present. |
| **One stylesheet** (`elx-loaders.css`), imported once | Or append it to an existing scoped stylesheet — never a second global one. |

---

## 1. Provenance

The timing constants, the bounded-stagger rule, and the announcement model are derived from a study of **`generative-loaders` v0.1.1** (MIT, Kasturi Khanke), measured directly from the published package. Four ideas were adopted; its 46 variants were not.

1. **The three-state taxonomy** (§2.1) — generalizes past text and images to charts, tables, and 3D.
2. **Bounded stagger** (§3) — the rule almost everyone gets wrong hand-rolling streamed reveal.
3. **`currentColor` + `color-mix` derivation** (§5) — one property themes the whole component.
4. **The announcement model** (§6) — one announcement per activity, not one per element.

---

## 2. Choose by state, not by aesthetic

### 2.1 Three epistemic states

| State | What the user knows | Treatment |
|---|---|---|
| **Pending** — request sent, nothing back | "It heard me." | Inline indicator |
| **Streaming** — partial content arriving | "It's working, and here's what it has." | Suffix reveal |
| **Deferred** — one atomic result, arrives whole | "Something is coming, and it will be *this big*." | Shape-matched skeleton |

### 2.2 Decision tree

```
Is there content on screen yet?
├── No, wait < 300ms .............................. show nothing
├── No, wait 300ms–1s ............................. delayed loader (300ms entry delay)
├── No, wait 1–4s ................................. inline indicator
├── No, wait 4–10s, shape known ................... skeleton of the real layout
├── No, wait > 10s ................................ determinate progress + stage label
├── Partially — content is streaming .............. suffix reveal
└── Yes, and it's being replaced .................. keep old content at 60% + inline indicator
```

### 2.3 The two rules violated most often

1. **Never replace rendered content with a skeleton on refetch.** Stale data at 60 % opacity plus a small header indicator beats a wall of gray rectangles. This is the single most common loading-state error in data products.
2. **The moment content becomes available, stop looping.** A looping animation beside real streaming content asserts two contradictory things.

### 2.4 Duration bands

| Wait | Treatment | Rationale |
|---|---|---|
| < 300 ms | Nothing | A loader that flashes reads as a glitch, not as feedback |
| 300 ms – 1 s | Optimistic UI, or a loader with a 300 ms entry delay | Prevents flash-of-loader on fast responses |
| 1 – 4 s | Inline indicator, 1.0–1.4 s cycle | |
| 4 – 10 s | Skeleton of the real layout, 1.4–2.4 s shimmer | Long cycles read as calm; short cycles read as frantic |
| > 10 s | Determinate progress **and** a stage label | Indeterminate motion past 10 s reads as *stuck* |
| Unknown, long | Stage labels without a bar, plus elapsed time | Never fake a bar you cannot honor |

---

## 3. Bounded stagger — the core engineering rule

For streamed text, pass the **complete response received so far**, diff against the previous string, and animate **only the new suffix**. Text already on screen never re-animates.

The per-character entrance stagger is `5 ms × charIndex`, **hard-capped at 35 ms total**:

```
delay = min(index × 5ms, 35ms)
```

Uncapped, a 400-character chunk takes 2 s to finish revealing, so the animation falls progressively further behind the stream and the whole interface feels laggy rather than fast. The cap preserves the *texture* of a staggered reveal while guaranteeing the suffix lands within ~35 ms plus the per-character duration.

**Any streamed-reveal animation must have a bounded total stagger, independent of chunk size.** Enforce it in CSS via `min()` so a caller cannot bypass it.

**Corollary:** do not key the whole component on a revision counter. That remounts and re-animates everything — the most common way this breaks. Key only the fresh-suffix span.

---

## 4. Timing tokens

| Token | Value | Applies to |
|---|---|---|
| `--elx-load-cycle-inline` | `1.2s` | Inline indicators |
| `--elx-load-cycle-block` | `2.35s` | Block skeletons, image/canvas frames |
| `--elx-load-shimmer` | `1.4s` | Shimmer sweep |
| `--elx-load-reveal` | `0.28s` | Per-element entrance |
| `--elx-load-stagger-step` | `5ms` | Per character |
| `--elx-load-stagger-max` | `35ms` | **Hard cap — non-negotiable** |
| `--elx-load-exit` | `0.18s` | Crossfade to content |
| `--elx-load-entry-delay` | `300ms` | Before showing a maybe-unneeded loader |
| `--elx-ease-load` | `cubic-bezier(0.22, 0.65, 0.30, 1)` | Reveals, shimmer |
| `--elx-ease-load-block` | `cubic-bezier(0.65, 0, 0.35, 1)` | Block/frame animations |
| Caret blink | `0.85s`, `steps(1, end)` | Typewriter caret |

Two ratios matter more than the absolute numbers. If you retune, preserve them:

- **block cycle ≈ 2 × inline cycle**
- **reveal ≈ 1/5 × inline cycle**

A `speed` multiplier divides duration (`d / speed`). Invalid, zero, or negative values must fall back to `1`.

---

## 5. Color

Derive every loader tint from `currentColor` via `color-mix` — **never a fixed gray**. One `color` property then themes the entire component, and dark mode requires no second rule set.

| Layer | Light | Dark |
|---|---|---|
| Resting placeholder fill | `currentColor 9%` | `currentColor 12%` |
| Shimmer highlight | `currentColor 16%` | `currentColor 20%` |
| Ghost text / edge | `currentColor 12%` | `currentColor 12%` |

- Dark mode bumps the resting fill because **additive light on a dark surface reads weaker** than subtractive dark on a light one. This is the only dark-mode adjustment the loader system needs.
- Skeletons must be visible but subordinate: **1.2–1.5:1** against the surface.
- The shimmer travels `-140% → 240%` so it fully clears both edges. Anything less shows a seam on loop.
- **Never color a loader with a semantic hue.** A loader is not a status.

---

## 6. Accessibility

Non-negotiable, in priority order:

1. **`prefers-reduced-motion: reduce` must produce a static *meaningful* state** — not an invisible one. Collapse durations, then explicitly keep the placeholder legible (raise the resting fill, disable the sweep, force revealed characters to full opacity).
2. **One announcement per activity.** If visible copy already says "Generating…", the adjacent indicator is `aria-hidden="true"`. Only a standalone indicator gets `role="status"` and a label.
3. **Streamed text lives in an `aria-live="polite"` region carrying plain text**; the animated per-character spans are `aria-hidden`. Never let a screen reader traverse 400 animated spans.
4. **Announce completion**, not only start.
5. **No flashing above 3 Hz.** The 1.2 s inline cycle is ~0.8 Hz.
6. **Reserve the space.** Layout shift at the handoff is an accessibility failure (CLS), not merely aesthetic.
7. **Pause must not unmount.** Use `animation-play-state: paused`.
8. Determinate progress uses `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label` naming the stage.

---

## 7. Application

### 7.1 The exit is half the design

- **Crossfade, never cut.** 160–220 ms opacity, ease-out, **overlapping** — no gap between loader out and content in.
- **Match the geometry.** The skeleton's bounding box must equal the content's.
- Skeleton and content share **one CSS grid cell**, so the container height cannot change at the handoff.

### 7.2 Motion families — one per surface

| Family | Reads as | Use for |
|---|---|---|
| **Reveal** — content emerges as-is | Calm, editorial | Default for text |
| **Resolve** — noise becomes signal | "A model is computing this" | Genuinely generative output only |
| **Structural** — a placeholder holds the shape | Neutral, enterprise | **Default for dashboards and data** |
| **Mechanical** — a device operates | Playful or technical | Rare, long, low-frequency operations |
| **Progressive** — a quantity fills | Determinate | Only when you actually know progress |

**Resolve** is the only family that makes a claim about *how* the content is being made. Using it on a database fetch is a lie.

### 7.3 Skeletons must be shape-matched

A gray rectangle where a chart goes is the dashboard equivalent of a spinner.

| Content | Skeleton |
|---|---|
| KPI metric | Three bars matching the hierarchy: label ~40 % × 14 px, value ~55 % × 36 px, delta ~65 % × 13 px |
| Bar chart | Gray bars at plausible **varied** heights, rounded caps, correct category count |
| Paired bars | Two bars per band with the correct 4 px inner gap |
| Stacked columns | Stacked segments with the same 3 px gaps and segment count |
| Capsule/pill columns | The capsule grid at resting opacity, stems omitted |
| Area / line | Flat shimmer band at ~40 % plot height with the gradient fade intact |
| Horizontal range bars | Full-width capsules at the correct row height and count |
| Progress rows | Track only, no fill |
| Heatmap | Full cell grid at the lowest ramp step, shimmer sweeping diagonally |
| Hexbin | The empty-hex field only |
| Dot matrix | The background dot grid only |
| Table | Correct row count and height, one shimmer bar per cell at realistic column widths |
| Canvas / 3D | Reserved box at final aspect ratio |

Two consequences worth internalizing:

- **When a chart already contains an "empty cell" layer — heatmap, hexbin, dot matrix — the skeleton *is* that layer.** Zero layout shift by construction.
- **Varied bar heights matter.** A row of equal-height gray bars reads as a placeholder grid; varied heights read as data about to arrive.

> **The one case in this repo that earns a loader today.** The layered elastic solver
> (`src/components/react/lea/lea.ts`) solves a dense linear system at every quadrature node,
> for every point in a depth profile. On a four-layer section that is thousands of solves, and
> the profile can take well over a second on a modest laptop — squarely in the 1–4 s band, and
> past 4 s when the wheel configuration is tandem. It should get a shape-matched depth-profile
> skeleton behind a `Swap`, and the KPI strip should show skeleton bars rather than stale
> numbers from the previous input. It currently shows neither.

### 7.4 Axis and label handling

Render the **real** axis labels immediately whenever the categories are known. Only the marks need a skeleton. A chart already legible as a *shape* makes the wait feel roughly half as long. If the categories are unknown, render label placeholders at the correct positions — never omit the axis space.

### 7.5 Placeholder values

**Never show `—` or `0` as a placeholder metric.** A zero that later becomes 1,657 is a misread, not a loading state. Use the skeleton bar.

### 7.6 Long computations

```
[███████████░░░░░░░░░]  62%
Generating contact patches · 8 of 13 configurations
Elapsed 00:14
```

- Determinate bar in the brand hue on the ghost track, 8 px, fully rounded.
- **The stage label is mandatory.** A bare bar says nothing about whether the job has stalled.
- A counter (`8 of 13`) whenever the work is enumerable.
- Elapsed time past 10 s. A cancel affordance past 15 s.
- If a stage can stall, show that stage's own elapsed time so a hang is visible rather than ambiguous.

### 7.7 Canvas and 3D surfaces

Three sub-states that must **not** share one loader:

1. **Asset fetch** — bytes known → real determinate progress.
2. **Parse / compile** — indeterminate but short → inline indicator, no bar.
3. **First frame** — crossfade the canvas in over 220 ms from the skeleton frame.

Reserve the canvas box at its final aspect ratio from first paint.

### 7.8 Anti-patterns

- A generic spinner where the content shape is known.
- Skeletons that don't match the real layout — worse than a spinner, because it lies about what's coming.
- Uncapped per-character stagger on streamed text.
- Re-animating the full response on every chunk.
- Percentage bars on operations whose duration you cannot estimate.
- Joke loading copy.
- More than one motion family visible at once.
- Loaders on operations under 300 ms.
- Replacing rendered content with skeletons on refetch.
- Semantic color on a loader.
- Full-screen blocking overlays for partial updates.
- Equal-height gray bars as a chart skeleton.

---

## 8. Source

The complete, copy-ready source for `elx-loaders.css` and `elx-loaders.jsx` is maintained with
this document. **This repo ships neither yet** — see the repo note at the top. When the first
loading state lands (§7.3 names the candidate), add the stylesheet as a single scoped block
appended to `src/components/react/tools.css` under the `cee-` prefix, matching the binding in
`chart-standards.md` §B, and port the components into `src/components/react/ui/`.

The pieces that must survive that port unchanged, because they are the load-bearing engineering
rather than styling:

- The `min(index × 5ms, 35ms)` stagger clamp, expressed in CSS so a caller cannot bypass it.
- `useAppendReveal` diffing against the previous string and keying **only** the fresh suffix.
- The `Swap` grid-cell crossfade, so the container height cannot change at the handoff.
- The `color-mix(in srgb, currentColor N%, transparent)` tint derivation.
- The `prefers-reduced-motion` block that keeps the placeholder *visible* rather than merely still.

---

## 9. Pre-merge checklist

**Integration**
- [ ] All tokens declared on the scope class, none on `:root`
- [ ] All classes and keyframes prefixed
- [ ] No bare element selectors, no reset, no `@font-face`
- [ ] No `!important` outside `prefers-reduced-motion`
- [ ] Every token reference has a fallback value
- [ ] Still one stylesheet

**Behavior**
- [ ] Loader chosen by state (pending / streaming / deferred), not by look
- [ ] Nothing shown under 300 ms; 300 ms entry delay on maybe-unneeded loaders
- [ ] Skeleton geometry equals content geometry — verify zero CLS at the handoff
- [ ] Chart skeletons have varied mark sizes, correct counts, correct gaps
- [ ] Real axis labels rendered immediately when categories are known
- [ ] No `—` or `0` placeholder values
- [ ] Streamed reveal animates the suffix only; total stagger capped at 35 ms
- [ ] Component not keyed on the revision counter
- [ ] Refetch keeps stale content at 60 %; never re-skeletons
- [ ] Determinate bar + stage label + counter for anything over 10 s; cancel past 15 s
- [ ] Exit crossfade 160–220 ms, overlapping
- [ ] One motion family per surface

**Color & motion**
- [ ] All loader tints derived from `currentColor` via `color-mix`
- [ ] No semantic hue on any loader
- [ ] Skeleton contrast 1.2–1.5:1 against its surface
- [ ] Ratios preserved: block ≈ 2× inline, reveal ≈ 1/5 inline
- [ ] Nothing flashes above 3 Hz

**Accessibility**
- [ ] `prefers-reduced-motion` yields a static *meaningful* state, not an invisible one
- [ ] Exactly one announcement per activity
- [ ] Streamed text live region carries plain text; spans are `aria-hidden`
- [ ] Completion announced, not only start
- [ ] Pause uses `animation-play-state`, never unmount
- [ ] `role="progressbar"` with valuenow/min/max and a stage label
