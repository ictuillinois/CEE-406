# Re-syncing the Gear3D port

Gear3D is a port of the standalone E-Lab at
`Johann-Cardenas.github.io/e-labs/gear3d`. It is maintained by **re-running these
transforms against a newer upstream**, not by hand-editing the ported files.

## What is a copy and what is generated

| In this repo | Origin | How |
|---|---|---|
| `src/components/react/gear3d/engine/**` | upstream `src/**` (36 modules) | plain copy |
| `src/components/react/gear3d/gear3d.js` | upstream `main.js` | `port-main.mjs` |
| `src/components/react/gear3d/gear3d.css` | upstream `styles.css` | `port-css.mjs` |
| `public/gear3d/data/**` | upstream `src/data/**` | plain copy |
| `public/gear3d/textures/**` | upstream `assets/textures/**` | plain copy |
| `src/components/react/gear3d/Gear3DApp.tsx` | upstream `index.html` body | hand-converted to JSX |
| `src/components/react/gear3d/icons.ts` | — | written here (upstream uses Font Awesome) |

`engine/**` is byte-for-byte upstream with **one** exception, marked `PORT NOTE`
in `io/exportRaster.js`: a `--g3-paper` lookup had to move off
`document.documentElement`, because the tokens are declared on `.g3-app` here.
Preserve that note when re-copying.

## Re-running

```bash
UP=../Johann-Cardenas.github.io/e-labs/gear3d

# engine + assets
cp -r "$UP/src"/{core,geometry,scene,annotate,contact,views,io} \
      src/components/react/gear3d/engine/
cp "$UP/src/data/tires.json" "$UP/src/data/SOURCES.md" public/gear3d/data/
cp -r "$UP/src/data"/{trucks,aircraft}                    public/gear3d/data/
cp "$UP/assets/textures"/*                                public/gear3d/textures/

# generated files
node scripts/port-gear3d/port-main.mjs "$UP/main.js"    src/components/react/gear3d/gear3d.js
node scripts/port-gear3d/port-css.mjs  "$UP/styles.css" src/components/react/gear3d/gear3d.css
```

Then re-apply the `PORT NOTE` in `engine/io/exportRaster.js`, and run
`npm run build`.

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

`port-main.mjs` — 22 rewrites:

- imports repointed to `./engine/`, and `icons` / `TextureLibrary` added;
- the module body wrapped in one `initGear3D(root)` closure returning a disposer;
- `$` and all nine `document.querySelectorAll` calls scoped to `root`, so two
  mounts cannot collide and nothing reaches outside the island;
- the data library and textures addressed through `BASE_URL` (see CLAUDE.md);
- `cssVar()` reads tokens off `root`, not `documentElement`;
- both `document` keydown maps named so the disposer can remove them;
- toast timers tracked, and `boot()` guarded against an unmount that lands
  during its one `await`;
- ten Font Awesome `<i>` tags replaced with `iconHtml()` — five inside
  single-quoted strings, five inside template literals, which is why the table
  is keyed on the *site* rather than on the icon name.

`port-css.mjs` — 34 rewrites:

- tokens moved off `:root` onto `.g3-app` (integration contract, §0.1);
- the palette re-skinned from upstream teal-on-slate to the course
  orange-on-navy — but **not** `--g3-fig-*`, which are the exported figure's
  colours and must not follow the site;
- `--g3-graphite` / `--g3-muted` deliberately kept: their comments record WCAG
  measurements, and the surfaces only moved lighter;
- `body.Gear3D` rescoped to `.g3-app` (34 rules that stop the host stylesheet
  repainting every control);
- the seven `… i {` icon rules retargeted at `.g3-i`;
- the shell handed its width to the Astro page.

## After any re-sync, check

- `npm run build` passes;
- the id audit still comes back clean — every id `gear3d.js` looks up exists in
  `Gear3DApp.tsx`. If upstream `index.html` grew a control, `Gear3DApp.tsx`
  needs it too; that file is the one piece with no transform behind it.
