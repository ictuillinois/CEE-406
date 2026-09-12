# Re-syncing the LEAPS port

LEAPS is a port of the standalone E-Lab at
`Johann-Cardenas.github.io/e-labs/leaps`. It is maintained by **re-running
these transforms against a newer upstream**, not by hand-editing the ported
files. The two copies are meant to be the same program, and this is what makes
that checkable rather than aspirational.

## What is a copy and what is generated

| In this repo | Origin | How |
|---|---|---|
| `src/components/react/leaps/engine/solver.js` | upstream `solver.js` | plain copy, byte for byte |
| `src/components/react/leaps/engine/worker.ts` | upstream `worker.js` | written here — one line differs, see below |
| `src/components/react/leaps/leaps.js` | upstream `app.js` | `port-main.mjs` |
| `src/components/react/leaps/markup.ts` | upstream `index.html` | `port-markup.mjs` |
| `src/components/react/leaps/leaps.css` | upstream `styles.css` | `port-css.mjs` |
| `src/components/react/leaps/icons.ts` | — | written here (upstream uses Font Awesome) |
| `src/components/react/leaps/LeapsApp.tsx` | — | written here (the island shell and the how-to) |
| `src/components/react/leaps/leaps.d.ts` | — | written here (types for the generated JS) |

## Why so little is transformed

Four rewrites in `port-main.mjs`, two in `port-markup.mjs`, three in
`port-css.mjs` — and that is the design, not luck. Everything a port would
normally have to patch is **injected upstream instead**:

| What a port usually patches | How LEAPS avoids it |
|---|---|
| where the Worker comes from | `opts.makeWorker`, defaulting to `new Worker('worker.js')` |
| where Plotly comes from | `opts.plotly`, defaulting to `window.Plotly` |
| which element the app owns | `initLeaps(root)` — every lookup is scoped to it |
| what typeface the canvas uses | the `--lp-font` and `--lp-mono` tokens |

So the body of `leaps.js` is byte-for-byte upstream, and it is deliberately
**not re-indented** into its new closure — the same decision `gear3d.js`
records — so `diff` against upstream reports the handful of real changes
rather than three thousand whitespace ones.

`worker.ts` is the one file written twice. It cannot be shared: upstream is a
classic worker and reaches the engine with `importScripts`, and Vite bundles a
module worker, which reaches it with `import`. The protocol either side of the
wire is identical, which is the part that matters.

## Re-running

```bash
UP=../Johann-Cardenas.github.io/e-labs/leaps

cp "$UP/solver.js" src/components/react/leaps/engine/solver.js

node scripts/port-leaps/port-main.mjs   "$UP/app.js"     src/components/react/leaps/leaps.js
node scripts/port-leaps/port-markup.mjs "$UP/index.html" src/components/react/leaps/markup.ts
node scripts/port-leaps/port-css.mjs    "$UP/styles.css" src/components/react/leaps/leaps.css

node scripts/us-english.mjs src/components/react/leaps     # last, over everything
```

Then `npm run build`.

### Verifying a sync

A sync that changed nothing upstream must change nothing here: run the three
transforms against an unchanged upstream and `git status` stays clean. That is
the cheapest possible check that the pipeline is still faithful, and it is
worth doing before trusting a real one.

### Testing a sync

```bash
node --test src/components/react/leaps/engine.test.mjs
node --test src/components/react/leaps/render.test.mjs
```

`engine.test.mjs` is the physics and the port. The physics half checks the
engine against Boussinesq's closed forms and, point by point over four
sections, against `lea/lea.ts` — a second, independent implementation of the
same problem that is itself pinned to Huang's printed answers, Burmister's
chart and Jones' table. **Mind the sign**: `lea.ts` is compression positive,
the convention the textbook uses, and LEAPS is tension positive, the
convention every layered-elastic program prints.

The port half is the half a re-sync breaks. `leaps.js` drives forty elements
by id across a file boundary and nothing in the type system connects the two,
so the test does: every id the app looks up exists in `markup.ts`, every glyph
it names exists in `icons.ts`, no Font Awesome markup survived, and the
generated files still carry their banner. `render.test.mjs` then
server-renders the island — `markup.ts` calls `iconHtml` at module load, so
importing it is itself the check that every glyph in the workspace exists.

### If a transform fails

It failed because an anchor moved upstream, which is exactly what it is for.
Fix the anchor here to match the new upstream text; do not fix the file it
produced. A hand edit to `leaps.js`, `markup.ts` or `leaps.css` is lost on the
next sync without anyone noticing, and the banner at the top of each of them
says so.

### What is different, on purpose

Three things, all in `port-css.mjs`:

1. **The palette is the course palette, and the themes are inverted.**
   Upstream is teal on slate and dark-first with a `[data-theme="light"]`
   override; this site is Illini orange on navy and light-first, because the
   house rule is that the complete light palette lives on the bare selector
   and only the dark tokens are redefined.
2. **The layout opts out of `.cee-tool`'s two-column grid** while keeping its
   tokens — the same move `crosssection.css` makes with `.xs-tool`.
3. **Glyph sizing**, because the port draws its own strokes.

The `.lp-page` rules — the standalone page's header and about strip — are left
in place deliberately. They are forty lines of CSS for markup this island does
not mount, and removing them would be a fourth transform to maintain for no
rendered difference.
