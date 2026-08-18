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
- React tools are islands mounted with `client:only="react"` (Plotly is browser-only; do not SSR them). Each tool: `src/components/react/<tool>/App.tsx` + shared `src/components/react/tools.css` + a wrapper page in `src/pages/tools/<tool>/index.astro`, registered in `src/data/tools.ts`, which the tools index AND the landing page both render from. Never add a tool to only one of those surfaces — they used to keep separate arrays and the landing page silently drifted to advertising 2 tools while 18 were live. Eighteen tools are live: mr-fitter + cbr (HW2), mastercurve (HW2/8, Ch. 7 + App. A), lea + stress-explorer (HW3/4), esal-calculator + eswl (HW5/7), drainage (HW6), aashto (HW7/9), damage (HW8), pca + westergaard + joints (HW9), acr + lca (HW10), psi (HW1/10, Ch. 9), backcalc (Ch. 9/13), reliability (Ch. 10).
- Tools whose maths is non-trivial keep it in a sibling `equations.ts` with **no React import**, and a `equations.test.mjs` beside it exercised against Huang's printed worked answers. Run them with `node --experimental-strip-types --test <path>`. Keep this split — it is what lets the physics be verified independently of the UI. Where a tool ships a preset that quotes data "as measured", a test asserts those numbers are the real forward solution, so a preset can never drift into invented data.
- **Every tool that implements book physics must be able to reproduce a printed worked answer**, and should ship that case as a preset so a student can calibrate the instrument before trusting it. Current anchors: westergaard → Examples 4.1–4.5; stress → Example 2.1; joints → Examples 4.8, 4.9, 4.11, 4.12, 4.13; eswl → Examples 6.1, 6.2, 6.3, 6.5; psi → Eqs. 9.14/9.15 and Problems 9.2, 9.4; mastercurve → Examples 2.16, 7.7–7.10 (and note Example 7.9 case 1 does **not** reproduce — the book's printed intermediate needs β4 where Eq. 7.25a calls for β3; the other eight cases match within 4%); backcalc → Example 13.11 (and note it only lands on the book's SN_eff once the Fig. 13.18 temperature factor is entered manually); reliability → Examples 10.11–10.13; pca → Example 12.1; lea/aashto/cbr/drainage/acr/esal → see their tests. Three tools still carry untested physics inside the React component: **damage, lca, mr** — the first two implement assignment/inventory formulas rather than book equations, `mr` is a log-space regression cross-checked indirectly by `scripts/datasets.test.mjs`.
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

## Content policy (IMPORTANT)

- `Chapters/` and `Homeworks Fall 2024/` at the repo root are **gitignored Box source archives**. The site serves curated copies from `public/textbook/` and `public/homeworks/`.
- **Never publish**: solution keys (`*Key*`, `*solutions*`), graded student submissions (e.g. `Lara Diab`), or exams (`Final Exam*`). When adding new semester materials, copy only assignments, handouts, references, and data files.
- Textbook PDFs are for enrolled students; the site is intended to run on **private** GitHub Pages.

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
