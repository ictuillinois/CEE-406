# Re-syncing the Gear3D port

Gear3D is a port of the standalone E-Lab at
`Johann-Cardenas.github.io/e-labs/gear3d`. It is maintained by **re-running these
transforms against a newer upstream**, not by hand-editing the ported files.

## What is a copy and what is generated

| In this repo | Origin | How |
|---|---|---|
| `src/components/react/gear3d/engine/**` | upstream `src/**` (39 modules) | plain copy |
| `src/components/react/gear3d/gear3d.js` | upstream `main.js` | `port-main.mjs` |
| `src/components/react/gear3d/gear3d.css` | upstream `styles.css` | `port-css.mjs` |
| `public/gear3d/data/**` | upstream `src/data/**` | plain copy |
| `public/gear3d/textures/**` | upstream `assets/textures/**` | plain copy, then the spelling pass |
| `public/gear3d/bodies/**` | upstream `assets/bodies/**` | plain copy |
| `src/components/react/gear3d/Gear3DApp.tsx` | upstream `index.html` body | hand-converted to JSX |
| `src/components/react/gear3d/icons.ts` | — | written here (upstream uses Font Awesome) |

`engine/**` is byte-for-byte upstream with **one** exception, marked `PORT NOTE`
in `io/exportRaster.js`: a `--g3-paper` lookup had to move off
`document.documentElement`, because the tokens are declared on `.g3-app` here.
Preserve that note when re-copying.

## Re-running

Vehicle switching in upstream `34fa3bf` and `cf5330e` prepares an uncached body before
replacing the document and scene, leaving the previous vehicle visible during
the download. Selection tokens and document identity reject stale requests.
Opening the vehicle menu warms two neighboring bodies unless Data Saver is on.
Eight wheel-geometry bundles and four fitted bodies are retained in LRU caches;
active scenes hold leases so eviction cannot invalidate a live view or export.
Aircraft intake colors and body materials remain private to each scene.
Assembly disposal releases instance buffers and leases; island teardown clears
the caches. Validation includes 72 course checks, 196 upstream checks, and
browser checks for cold/warm switches, shared geometry, independent intake
colors, stable GPU geometry counts, and deliberately delayed requests.
Swaps begin at interaction resolution and restore full quality after settling.
Repeated A320/737 switches in the final browser run took 26–36 ms in mobile
emulation and typically 28–33 ms on desktop, with slower outliers. These are
local browser measurements, not physical-device or network latency guarantees.

The visual refinement in upstream `cb50f96` adds cached aggregate and slab
textures, adjustable bump relief, and optional cloud cover. Compact and touch
views cap live rendering at 1.5 million pixels when settled and 0.75 million
while moving, with 1024-pixel shadow maps. Auto geometry retains its own detail
selection on mobile instead of inheriting the Ultra tier's geometry floor.
Offscreen and hidden views pause rendering. Figure export resolution and the
startup scene are unchanged. Validation: production build, 70 course checks,
196 upstream checks, and desktop/mobile browser checks for cache reuse, scene
controls, project persistence, viewport resizing, and offscreen pausing. Mobile
checks use browser emulation; physical-device frame rates were not measured.

The October 2026 scenery update originates in upstream `f9f27f1` and `962098b`:
optional asphalt/concrete textures, sky
backgrounds, and solid body rendering. The subsequent startup refinement opens
in 3D with shaded satin bodies at the Detailed preset (60%), 100% intake detail,
all running gear, and ghost context enabled. Dimension sets, annotations, and
the scale bar start off. Publication white and the studio shadow catcher remain
the scene defaults. Scene settings persist in the
view block; they never change axle layouts or contact calculations. Surface
textures and sky gradients are procedural and cached, and disposal releases
them. Range controls use the existing interaction-resolution tier while moving.

Startup defaults and restored checkbox synchronization come from upstream
`bc10217`. Explicit saved settings are preserved; missing view fields use the
new defaults. The tool thumbnail matches the new startup view. Validation:
production build, 196 upstream checks, 36 course checks, and browser checks for
fresh defaults, active controls, body reset, saved preferences, and legacy files.

```bash
UP=../Johann-Cardenas.github.io/e-labs/gear3d

# engine + assets
cp -r "$UP/src"/{core,geometry,scene,annotate,contact,views,io} \
      src/components/react/gear3d/engine/
cp "$UP/src/data/tires.json" "$UP/src/data/SOURCES.md" public/gear3d/data/
cp -r "$UP/src/data"/{trucks,aircraft}                    public/gear3d/data/
cp "$UP/assets/textures"/*                                public/gear3d/textures/
cp -r "$UP/assets/bodies"                                 public/gear3d/

# generated files
node scripts/port-gear3d/port-main.mjs "$UP/main.js"    src/components/react/gear3d/gear3d.js
node scripts/port-gear3d/port-css.mjs  "$UP/styles.css" src/components/react/gear3d/gear3d.css

# American spelling, LAST, over the copied and the generated files alike
node scripts/us-english.mjs src/components/react/gear3d public/gear3d/textures
```

`public/gear3d/textures` is in that pass because its `CREDITS.md` is the one
copied asset file the port respells (two words). The data and the bodies need
nothing, and `node scripts/us-english.mjs --check public/gear3d` says so.

Then re-apply the `PORT NOTE` in `engine/io/exportRaster.js`, and run
`npm run build`.

The spelling pass is not optional and is not cosmetic. Upstream spells British
and this repository spells American, because every printed reference the course
works against does — the dictionary is enumerated in `scripts/us-english.mjs`.
Skipping the pass leaves the two spellings mixed inside one file, and the next
person to write an anchored edit against either of them picks the wrong one, so
the transform fails on a word rather than on a line of code. Run it last, after
both the copy and the generated files.

Note that this README is itself in the pass's path, which is why it does not
spell out the words: written down as examples they would be rewritten into
their American forms and the sentence would stop meaning anything. The two port
transforms are exempted for the same reason — see `SKIP_FILES` — because every
`find` argument in them quotes upstream verbatim.

### Verifying a sync

A sync that changed nothing upstream must change nothing here. `cp` + the port
note + `us-english.mjs`, run against an unchanged upstream, leaves `git status`
clean — that is the cheapest possible check that the pipeline is faithful, and
it is worth doing before trusting a real one.

### Testing a sync

`node --test src/components/react/gear3d/units.test.mjs` re-reads the display
system: that no unit label sits against an interpolated value in the generated
file, that every function formatting through `UNIT_SYSTEMS` is re-run by
`setUnitSystem`, that SI comes out byte-identical to `units.js` itself, and
that every English magnitude the library was cited in survives the rounding in
`engine/core/readable.js`. Upstream carries the same module and the same checks
as §15 of its own suite, so a sync that loses either end fails on both sides.

`node --test src/components/react/gear3d/geometry.test.mjs` builds the actual
tire, rim and hub meshes for every designation in the library. **Nothing else
in either suite does**: the upstream E-Lab's checks cover the data, the layout
and the exports, and `render.test.mjs` server-renders the islands but never
runs a `client:only` island's effects, so it never reaches a line of three.js.
The one time a merge threw on its first call, all 176 upstream checks passed
and the tool rendered an empty viewport.

## Anchors are spelled the way UPSTREAM spells

Every `find` string quotes main.js byte for byte, so its spelling tracks
upstream and never this repository. Upstream spelled British until its own
American pass (`11f9c56`); the anchors were updated to match in the 2026-09
sync, and `scripts/us-english.mjs` skips this script — see `SKIP_FILES` —
precisely so a run of that pass cannot silently break them. If a future
upstream changes its spelling again, the anchors follow it, not us.

## Why the transforms assert

Every rewrite is an anchored `sub()` / `subRe()` with an expected match count.
If upstream moves a line the script targets, the run **fails loudly** rather
than producing a file that is 95% ported and broken in one place you will not
find until a student does. A failure means: read the new upstream, update that
one anchor, re-run.

The count in each assertion is part of the contract. If upstream adds a tenth
`document.querySelectorAll`, the `9` fails — which is the point, because the new
one also needs scoping to the island root.

## What the transforms change, and why

Only port concerns. If a change would be right for the standalone E-Lab too,
it belongs in upstream `main.js` and arrives here through a re-sync — that is
where the unit-system work went in 2026-09, rather than into an eleventh
section of this script. A transform that carries product changes stops being
a transform and becomes a fork.

`port-main.mjs` — 24 rewrites:

- imports repointed to `./engine/`, and `icons` / `TextureLibrary` added;
- the module body wrapped in one `initGear3D(root)` closure returning a disposer;
- `$` and all eleven `document.querySelectorAll` calls scoped to `root`, so two
  mounts cannot collide and nothing reaches outside the island;
- the data library and textures addressed through `BASE_URL` (see CLAUDE.md),
  and upstream's own `ASSET_BASE` (`./assets/`, where the vehicle bodies live)
  consumed by the closure opener and replaced by the port's `public/gear3d/`;
- the vehicle-body GLB continuation guarded against an unmount, like `boot()`,
  and `disposeVehicleBodies()` imported and called by the disposer, because
  the loaded templates are module-level and shared by every mount;
- `cssVar()` reads tokens off `root`, not `documentElement`;
- both `document` keydown maps named so the disposer can remove them;
- toast timers tracked, and `boot()` guarded against an unmount that lands
  during its one `await`;
- ten Font Awesome `<i>` tags replaced with `iconHtml()` — five inside
  single-quoted strings, five inside template literals, which is why the table
  is keyed on the *site* rather than on the icon name.

`port-css.mjs` — 36 rewrites:

- tokens moved off `:root` onto `.g3-app` (integration contract, §0.1), the
  first block also carrying `box-sizing: border-box`, which the shell's
  `width: 100%` needs and upstream's centered max-width box never did;
- upstream's tablet side gutter zeroed, because the Astro container already
  has one;
- upstream's teal-black `#06222a` (ink on the accent, and the title-block
  mark tile) mapped to the course navy, seven sites including the tile's
  shadow;
- the palette re-skinned from upstream teal-on-slate to the course
  orange-on-navy — but **not** `--g3-fig-*`, which are the exported figure's
  colors and must not follow the site;
- `--g3-graphite` / `--g3-muted` deliberately kept: their comments record WCAG
  measurements, and the surfaces only moved lighter;
- `body.Gear3D` rescoped to `.g3-app` (34 rules that stop the host stylesheet
  repainting every control);
- the seven `… i {` icon rules retargeted at `.g3-i`;
- the shell handed its width to the Astro page.

## When a change was made here first

It happened once, and this is how it was reconciled. The v1.13 work (vehicle
bodies, the reversible wide-base swap, the figure bar, 21 new aircraft) was
built in this repository, editing `engine/**`, `gear3d.js`, `gear3d.css`,
`Gear3DApp.tsx` and `public/gear3d/` directly, and was then brought upstream
(2026-09-18):

1. `engine/**`, `public/gear3d/data/**` and `public/gear3d/bodies/**` went
   up as plain copies (the `PORT NOTE` excepted);
2. the `gear3d.js` / `gear3d.css` diffs since the last sync were applied to
   upstream `main.js` / `styles.css` with the port-only lines taken out, and
   each port-only line became a rewrite here instead — the four new ones
   above;
3. `Gear3DApp.tsx`'s markup changes were hand-written into upstream
   `index.html` (upstream's own palette on the new mark);
4. the full pipeline above was then run against the new upstream, and left
   this tree byte-identical.

Upstream's suite caught two data defects this repository's tests could not
(DECISIONS D43 there): twenty source citations with no publisher, fixed in
`scripts/import-gear3d-aircrafter.py` and regenerated from the same workbook,
and a stale 767-400ER pin. Doing it this way round costs a reverse diff; the
next change should go upstream first.

## After any re-sync, check

- `npm run build` passes;
- the id audit still comes back clean — every id `gear3d.js` looks up exists in
  `Gear3DApp.tsx`. If upstream `index.html` grew a control, `Gear3DApp.tsx`
  needs it too; that file is the one piece with no transform behind it.
