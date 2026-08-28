# CEE 406 Pavement Design I — Project Guide

## Overview

Astro 6 static course portal for CEE 406 (UIUC, Prof. Imad L. Al-Qadi). Content is organized **by homework**: 10 homework pages, a 20-part online textbook (Huang 2004), and interactive React tools. Design system inherited from `ictuillinois/ict-mechanics` (navy `#0F1A2E` / orange `#E87722`, Sora + IBM Plex, dark mode, Pagefind search).

## Getting started

```bash
npm install
npm run dev      # localhost:4321
npm run build    # astro build + pagefind indexing
```

Requires Node >= 22.12.0.

## Architecture rules

- **Content lives in `src/data/homeworks.ts` (metadata, problems, downloads), `src/data/hwGuides.ts` (purpose, KaTeX concept cards, steps, pitfalls), `src/data/textbook.ts`, and `src/data/tools.ts` (the tool catalogue: name, slug, colour, HW chips, reference, description, SVG glyph)** — pages under `src/pages/homeworks/[id].astro` and `src/pages/textbook/[id].astro` are generated from them. To change homework content, edit the data files, not the pages. Guide bodies are HTML with KaTeX (`$...$`/`$$...$$`, backslashes escaped in TS strings).
- React tools are islands mounted with `client:only="react"` (Plotly is browser-only; do not SSR them). Each tool: `src/components/react/<tool>/App.tsx` + shared `src/components/react/tools.css` + a wrapper page in `src/pages/tools/<tool>/index.astro`, registered in `src/data/tools.ts`, which the tools index AND the landing page both render from. Never add a tool to only one of those surfaces — they used to keep separate arrays and the landing page silently drifted to advertising 2 tools while 18 were live. Twenty-one tools are live: mr-fitter + cbr (HW2), mastercurve (HW2/8, Ch. 7 + App. A), lea + stress-explorer (HW3/4), esal-calculator + eswl (HW5/7), drainage (HW6), aashto (HW7/9), damage (HW8), pca + westergaard + joints (HW9), acr + lca (HW10), psi (HW1/10, Ch. 9), backcalc (Ch. 9/13), reliability (Ch. 10), cross-section-studio (figures, Ch. 1), gear3d (HW4/5, Ch. 6), contact-stress (HW3/4, Ch. 1).
- **`cross-section-studio` and `gear3d` are the two islands that are not React apps.** Both are ports of standalone Three.js E-Labs from `Johann-Cardenas.github.io/e-labs/`, and both follow one shape: the engine is a single `init*(root)` closure that owns the DOM imperatively and returns a disposer, and the `*App.tsx` supplies markup and calls it from one effect. Keep them apart — React must never be asked to re-render a WebGL scene, and the disposer must keep tearing down the rAF loop, the ResizeObserver, the WebGL context and the document `keydown` handlers or a remount leaves two render loops on one canvas. Both opt out of the `.cee-tool` two-column grid (via `.cee-tool.xs-tool` / `.cee-tool.g3-tool`) while keeping its tokens, and both carry control help on `title` rather than `<Tip>`, because their side rails are `overflow: auto` and would clip an absolutely positioned popover. `three` is pinned to `0.160.1` — the version both upstream import maps pin — so the render is bit-for-bit the same.
- **The two E-Lab ports are maintained by re-running their transform scripts, not by hand-editing.** `gear3d/engine/**` is a byte-for-byte copy of the upstream `src/**` (36 modules; the only hand edit is a PORT NOTE in `io/exportRaster.js`, where a token lookup had to move off `documentElement`), and `gear3d.js` / `gear3d.css` are generated from upstream `main.js` / `styles.css` by scripts that assert every anchor they rewrite and fail loudly if one has moved. The body of `gear3d.js` is deliberately **not** re-indented into its closure, so `diff` against upstream reports the twenty-odd real changes rather than three thousand whitespace ones. If you change one of these files by hand, the next upstream sync silently loses it — put the change in the transform instead.
- **A port's data and textures live in `public/`, not beside its modules.** Upstream Gear3D resolves its vehicle library with `new URL('./src/data/', import.meta.url)`; under Vite that module is bundled into `_astro/` and the data is no longer beside it. The library and the CC0 textures are served from `public/gear3d/` and addressed through `BASE_URL`. `TextureLibrary` and `AssetLibrary` already take an injectable `basePath`, so nothing in the engine had to change for it.
- **`--g3-fig-*` and the figure ink in `gear3d.js` are deliberately not themed.** They are the colours of the *drawing*, and they end up in PNGs, SVGs and PDFs that go into student reports. A figure must not change because the course site changed its accent colour. The app chrome around them is re-skinned to the course palette; the plate is not.
- **A re-skin does not inherit the upstream's contrast results — re-run the gate.** `gear3d/tokens.test.mjs` is a port of §14 of the upstream E-Lab's own suite, and it caught a real regression the re-skin introduced: upstream's dark `--g3-muted` is documented as "4.53:1 at worst", but that was measured on upstream's slate; the course's raised navy `#1b2740` is lighter, and the same token landed at **4.46:1** — an AA failure on every secondary label in the dark theme, caused purely by moving the surface underneath it. It is lifted to `#8293a1` (4.71:1) in `port-css.mjs`. Run it with `node --test src/components/react/gear3d/tokens.test.mjs`.
- **`contact-stress` is the one tool whose physics is a trained network, and the network is not in this repo.** phyContactGAN (Lang, Villamil & Al-Qadi 2026, ICT — three 135 MB checkpoints plus 6 GB of training arrays) lives only in the gitignored Box archive `Contact Stress Predictor/`, beside the offline pipeline that reads it. What ships is `public/tools/contact-stress/` — a precomputed sample of the model's **output** over the whole of its training domain, compressed to a shared PCA basis per tyre and channel (DTA 6,300 grid nodes, K = 64/32/28 at 2 mm, 2.8 MB gzip; WBT 119 nodes, K = 26/18/18, 1.0 MB, lazy-loaded). `predictor.ts` decodes it and reconstructs `mean + Σ c_k φ_k` with 4-point cubic interpolation on the axes; measured held-out error against the generator is 0.007 MPa rms on σz and 0.4% on peak, *below* the 0.0086 MPa RMSE the model itself carries against FEA. Never copy a `.pth`, a `.npz`, or the pipeline into `src/` or `public/` — `predictor.test.mjs` asserts the shipped payloads are too small to be a checkpoint.
- **Re-baking `contact-stress` is a five-stage pipeline, and stages must not share a process.** `Contact Stress Predictor/pipeline/`: `bake_fields.py` (torch) → `bake_pca.py` (numpy) → `validate_truth.py` (torch) → `validate_check.py` (numpy) → `fixture_truth.py` + `fixture_build.py` (which writes the checked-in `fixture.json`). Torch and numpy BLAS must run in **separate processes**: the conda env links two OpenMP runtimes and importing both raises OMP error #15, whose only workaround is documented as possibly producing silently wrong results. `artifact.py` is the reference decoder and `predictor.ts` must agree with it to 1e-4 MPa; the Node test asserts it. Re-run `fixture_build.py` after any re-bake or the fixture describes an artefact that no longer exists.
- **A surrogate's residuals are teaching content, not an embarrassment to hide.** `contact-stress` puts the vertical equilibrium closure (Σσz·A / applied load — 87% on the paper's own headline case) and the tensile fraction on the page as KPIs, and warns when either leaves its band. Equation 5 of the paper trains equilibrium as a *soft* penalty, so the residual is real information about how much to trust a prediction. Same rule as the chart-value tools: record the discrepancy, never quietly correct it.
- Tools whose maths is non-trivial keep it in a sibling `equations.ts` with **no React import**, and a `equations.test.mjs` beside it exercised against Huang's printed worked answers. Run them with `node --experimental-strip-types --test <path>`. Keep this split — it is what lets the physics be verified independently of the UI. Where a tool ships a preset that quotes data "as measured", a test asserts those numbers are the real forward solution, so a preset can never drift into invented data.
- **Every tool that implements book physics must be able to reproduce a printed worked answer**, and should ship that case as a preset so a student can calibrate the instrument before trusting it. Current anchors: westergaard → Examples 4.1–4.5; stress → Example 2.1; joints → Examples 4.8, 4.9, 4.11, 4.12, 4.13; eswl → Examples 6.1, 6.2, 6.3, 6.5; psi → Eqs. 9.14/9.15 and Problems 9.2, 9.4; mastercurve → Examples 2.16, 7.7–7.10 (and note Example 7.9 case 1 does **not** reproduce — the book's printed intermediate needs β4 where Eq. 7.25a calls for β3; the other eight cases match within 4%); backcalc → Example 13.11 (and note it only lands on the book's SN_eff once the Fig. 13.18 temperature factor is entered manually); reliability → Examples 10.11–10.13; pca → Example 12.1; contact-stress → the four summed vertical stresses printed for Figure 7 of Lang et al. 2026 (5276.8, 12405.3, 18756.7, 39595.6 N), reproduced within 1.5%, plus Figures 6, 8, 9 and 10 as presets; lea/aashto/cbr/drainage/acr/esal → see their tests. Three tools still carry untested physics inside the React component: **damage, lca, mr** — the first two implement assignment/inventory formulas rather than book equations, `mr` is a log-space regression cross-checked indirectly by `scripts/datasets.test.mjs`.
- **Any hand-rolled linear solver must be round-trip tested against a system with a known answer.** `solve4` in `mastercurve/equations.ts` once wrote `row[i][i]` — indexing into a *number*, which yields `undefined` and turns every solution into `NaN`. The Levenberg-Marquardt loop then rejected every step and silently returned its seed, producing plausible-looking curves that optimised nothing, and a wrong conclusion that got as far as a written report. The same expression still sat as dead code in `lea/lea.ts` (harmless there, discarded by a second map) and has been removed. Fit synthetic data with known parameters; assert the parameters come back.
- Where the literature gives **two defensible answers** to one question, show both rather than picking silently — westergaard does this for edge contact shape (circle vs. semicircle, Eqs. 4.22/4.23) and for the corner formulation (original Eqs. 4.13/4.14 vs. Ioannides Eqs. 4.15/4.16); mastercurve for AI vs. Shell |E*| (65% apart on Example 7.10); joints for the dowel load reach (Friberg 1.8ℓ, which Huang's examples use, vs. Heinrichs 1.0ℓ, which Huang says is correct — plus a third convention, 1.0ℓ with 0.45W, that Eq. 12.3 was calibrated against and which faulting must therefore use); eswl for all four ESWL criteria at once (5630–7410 lb on Huang's Example 6.1). The disagreement is the teaching content.
- **A tool that computes a chart value should say it is doing so.** Several tools integrate a kernel where Huang reads a figure — `stress` for Figures 2.2 and 2.6, `eswl` for the ESWL factors, `westergaard` for Bradbury's chart. That is more accurate, but it means the tool will not exactly reproduce a printed answer that came off a chart, and the tests carry the tolerance and the reason. Never silently "fix" a book value to match; record the discrepancy.
- **Charts, KPIs, cards, and tables follow the standards in `docs/` — read `docs/README.md` first.** `dashboard-visual-language.md` is the system, `loaders.md` the loading states, `chart-standards.md` the CEE 406 binding. It is binding: §A is the visual language (stripped chart chrome, rounded bar geometry, fixed categorical order, sequential ramps, motion, a11y), §B is the CEE 406 binding (navy/orange token map, semantic hue per physical quantity, Plotly deviations). §B wins where they disagree.
- Chart theming is centralized in `src/components/react/chartTheme.ts` (useTheme hook, per-mode series palette, baseLayout). Palettes are validated (dataviz six-checks) per surface — light on `#fff`, dark on `#162033`. Don't hardcode series colors in tools; use the semantic binding in `docs/chart-standards.md` §B4 (stress→orange, strain→blue, deflection→emerald, traffic/cost→amber, damage→violet, temperature→pink).
- Always build internal links with `import.meta.env.BASE_URL`.
- Theme key is `localStorage('cee406-theme')`; `[data-theme="dark"]` overrides live in `global.css`.
- KaTeX auto-renders `$...$` inside elements when the page has `.doc-equation` or `[data-katex]`.
- Signature visual: pavement cross-section motif — `PavementHero.astro` (canvas: tandem axle bogie, superposed pressure bulbs, viscoelastic deflection basin), `LayerGlyph.astro` (per-HW glyph), footer layer-rule. Keep new UI consistent with it.
- Tool UX standard: every input gets a `Tip` tooltip, every tool gets a `<details class="cee-howto">` how-to panel and `cee-warn` validation messages. Don't use CSS `text-transform: uppercase` on labels containing Greek letters (σ → Σ); write labels pre-uppercased.
- **Dependency pins**: `astro@6.0.8` and `@tailwindcss/vite`/`tailwindcss@4.2.2` are exact pins — `@tailwindcss/vite` 4.3.x pulls Vite 8 against Astro's Vite 7 and the build fails ("Missing field tsconfigPaths"). Don't bump without testing.
- Plain CSS files don't support `:global()` — in `global.css` write `[data-theme="dark"] .foo` directly.

## Content policy (IMPORTANT — the repo is PUBLIC)

**The repository and its Pages site are public.** Anything committed is world-readable at `github.com/ictuillinois/CEE-406` and at `raw.githubusercontent.com`, whether or not a page links to it, and whether or not it is later deleted — git keeps history. Assume every file you add is published the moment it is pushed.

- `Chapters/` and `Homeworks Fall 2024/` at the repo root are **gitignored Box source archives** and hold the instructor's originals, solution keys included. They are the restore source; nothing below deletes them.
- **The textbook is not ours to distribute.** Huang, *Pavement Analysis and Design* (2004) is a copyrighted commercial text. All 20 chapter/appendix PDFs were removed from `public/textbook/` and **purged from git history**; `public/textbook/` is gitignored so they cannot be re-added by accident. The chapter pages survive as a reading map — citation, the course's own chapter summaries, related homeworks — and link to the [UIUC Library record](https://i-share-uiu.primo.exlibrisgroup.com/nde/fulldisplay?docid=alma99598836912205899&vid=01CARLI_UIU:CARLI_UIU_NDE). `TextbookEntry` deliberately has no `pdf` field.
- **Never publish**: solution keys (`*Key*`, `*solutions*`), graded student submissions (e.g. `Lara Diab`), exams (`Final Exam*`), or third-party publications you have not confirmed you may redistribute — AASHTO standards, textbook excerpts, and reproduced chart/table handouts are the ones this course has previously carried.
- **Publishing is opt-in, per item, via `src/data/release.ts`.** Nothing is visible until it is released there. Hiding a card is not enough — see below.

## The release gate (`src/data/release.ts`)

One file, edited weekly, is the single source of truth for what the site shows. "Hidden" has **three** independent meanings and all three are enforced by `src/data/release.test.mjs`:

1. **No card** on any index — `homeworkLock()` / `toolLock()`, used by the landing page, both indexes, and the chapter pages.
2. **No route** at the URL. A homework page is generated from data, so `getStaticPaths` filters to released ids. A tool page is a *file*, so hiding its card does nothing: the locked ones are renamed `_index.astro`, which Astro does not route. **Releasing a tool is therefore two steps** — add the slug to `RELEASED_TOOLS` *and* rename `_index.astro` → `index.astro`. The test fails if the two disagree in either direction.
3. **No file** under `public/`. A PDF in `public/` is served whether or not anything links to it. `public/homeworks/` is empty; unlocking a homework means copying that week's files out of the Box archive into `public/homeworks/<id>/`. The test fails if files exist for an unreleased homework.

Currently released: **tools** `gear3d`, `cross-section-studio`, `contact-stress`; **homeworks** none. Locked items render as a dimmed, dashed, non-interactive card with a lock chip reading "Coming soon", or "Releases week N" once `HOMEWORK_WEEK` / `TOOL_WEEK` carry the real semester calendar.

## Deployment

- Push to `main` → `.github/workflows/deploy.yml` → GitHub Pages. **Current state: enabled, private, `build_type=workflow`, live at `https://glowing-pancake-8gkkgl1.pages.github.io/`** (first successful deploy: run #3, 2026-07-13).
- The workflow auto-detects Pages visibility (`gh api .../pages --jq '.public'`) and sets `PAGES_PUBLIC` for the build:
  - private (current): `base: '/'`
  - public: `base: '/CEE-406/'`, site `https://ictuillinois.github.io`
- `actions/configure-pages` **cannot enable** Pages with the workflow token here (runs #1–2 failed on it); Pages was created via the REST API with a user token. The step is harmless now that Pages exists.
- On this dev machine `gh` is not installed. For REST API calls, get a working token with
  `git -c credential.useHttpPath=true credential fill` fed `protocol=https / host=github.com / path=ictuillinois/CEE-406.git` — the returned `gho_` password works as `Authorization: Bearer`. (Plain host-only `credential fill` returns stale PATs that 401.)
- Before changing anything deployment-related, check current visibility:
  `GET /repos/ictuillinois/CEE-406/pages` → `{public, html_url}`
- **Pages source must be "GitHub Actions", not "Deploy from a branch".** If it is set to a
  branch, GitHub additionally runs its built-in `pages build and deployment` (Jekyll) workflow
  on every push, which fails on an Astro source tree — a red run per commit even while
  `deploy.yml` succeeds. The two are different workflows; check the *name* in the failure
  notification before debugging `deploy.yml`. Fix in Settings → Pages → Build and deployment →
  Source: **GitHub Actions**, or `PUT /repos/ictuillinois/CEE-406/pages` with
  `{"build_type":"workflow"}`.
- `.nojekyll` exists at the repo root and in `public/` (so it lands in `dist/`). Both are
  required: the root one neutralises the legacy Jekyll builder if the source is ever a branch,
  and the `public/` one keeps Jekyll from stripping Astro's `_astro/` directory out of the
  published artifact — directories beginning with `_` are dropped by Jekyll.
- On this dev machine the credential helper is Git Credential Manager, which only prompts via
  GUI. `git credential fill` therefore hangs or returns nothing in a non-interactive shell, and
  the repo is private so the REST API 404s unauthenticated. To inspect a failing run, either
  read it in the browser or run the API call yourself with a PAT.

## Per-student datasets (`scripts/`)

- `scripts/datasets.mjs` generates one student's whole-semester data deterministically from
  `hash(UIN + salt)`; `scripts/generate-datasets.mjs` is the instructor CLI that writes per-student
  CSV bundles plus `_answer-key.json`. Nine handouts cover HW1–HW10: triaxial M_r, CBR, W-4 table,
  drainage site, IDOT scenario, rigid slab, axle distribution, FWD survey, and the scalar assignments.
- **Draw order is the RNG contract.** Inserting a new generator anywhere but the end of
  `studentBundle` silently reshuffles every dataset drawn after it. Append new generators last and
  sort them into homework order in the returned object, which does not affect the stream.
- **The salt is the whole security model.** This repo is readable by the class, so an unsalted run
  produces data whose answers any student can re-derive from the source. The CLI refuses to run
  without `--salt`. Keep it out of git and change it every semester.
- Never publish `_answer-key.json`, and never add truth values (k₁–k₃, true CBR, station moduli,
  the section-break location) to a student-facing file. `scripts/datasets.test.mjs` enforces this,
  and the tests also assert every generated dataset is *solvable* — the Mr data regresses back to
  its own k-values, the CBR curve reduces to its own CBR, the FWD basins backcalculate to the
  moduli that made them, every slab lands where the thickness decision is real (σ/MR between 0.2
  and 1.35), and the drainage layer carries its own inflow.
- Some datasets are tuned for **pedagogical distribution**, not just validity, and the tests pin
  those distributions: roughly half the class gets a filter gradation that fails at least one
  criterion (or HW6 P5's "propose a fix" is vacuous), both fatigue and erosion govern for somebody
  in HW9 P4, and HW2's injected outliers never land on the first or last readings. Changing a range
  without re-checking these will quietly hollow out an assignment.
- Rationale and the homework redesign that depends on it: `docs/HW_Recommendations.html`.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `style:`, `ci:`).
- Astro for static UI; React only for interactivity.
- Tool engineering references belong in the tool header/notes (e.g., "Huang Eqs. 2.1–2.6", "AASHTO 1993 App. D") so students can verify formulas.
