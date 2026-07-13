# CEE 406 — Pavement Design I

**Course portal for CEE 406 Pavement Design I at the University of Illinois Urbana-Champaign**, taught by Prof. Imad L. Al-Qadi.

Built with Astro 6, React 19, Tailwind CSS v4, Plotly.js, GSAP, and Pagefind — deployed to GitHub Pages. Design system shared with [ict-mechanics](https://github.com/ictuillinois/ict-mechanics).

---

## What's on the site

The site is organized **by homework** — each assignment is the hub that links the tools and textbook chapters needed to solve it.

### Homeworks (`/homeworks/`)
Ten assignment pages (HW1–HW10, Fall 2024 edition), each with overview, learning objectives, problem set, downloadable assignment + handouts, related textbook chapters, and the online tools it uses. Grouped by course phase: Fundamentals → Materials → Analysis → Loads & Drainage → Design.

### Textbook (`/textbook/`)
Huang, *Pavement Analysis and Design* (2nd ed., 2004) — 13 chapters and 7 appendices, each readable in an embedded PDF viewer with download links and cross-references back to the homeworks. **For enrolled students only.**

### Online tools (`/tools/`)
Interactive calculators built as React islands:

| Tool | Homeworks | What it does |
|------|-----------|--------------|
| **Stress Explorer** | HW3, HW4 | One-layer (Boussinesq) response under a circular load — σz, σr, εz, εr, w vs. depth (Huang Eqs. 2.1–2.6), live charts + normalized table |
| **ESAL Calculator** | HW5, HW7 | Exact AASHTO flexible EALFs (1993 Guide App. D), mixed axle spectrum, growth/directional/lane factors, design ESALs |

Planned: Resilient Modulus Fitter (HW2), Transfer-Function Damage (HW8), Westergaard Slab Stress (HW9), Pavement LCA Worksheet (HW10).

### Site features
- Animated pavement cross-section hero (rolling wheel + Boussinesq pressure bulbs)
- Full-text search (Pagefind) with Ctrl/Cmd+K modal
- Dark/light theme, KaTeX equations, GSAP scroll reveals
- Custom 404 ("pothole ahead")

---

## Quick start

```bash
npm install          # Install dependencies
npm run dev          # Dev server at localhost:4321
npm run build        # Production build + Pagefind indexing
npm run preview      # Preview production build
```

Requires **Node.js >= 22.12.0**.

---

## Project structure

```
src/
├── layouts/
│   ├── BaseLayout.astro       # HTML shell, nav, footer, theme, search, KaTeX, GSAP
│   └── DocsLayout.astro       # 3-column docs layout (used by homework pages)
├── components/
│   ├── Nav.astro              # Fixed nav: Home / Homeworks / Textbook / Tools
│   ├── Footer.astro           # Footer with pavement layer-rule divider
│   ├── PavementHero.astro     # Signature canvas hero
│   ├── LayerGlyph.astro       # Mini layer-stack glyph (per-homework focus)
│   ├── SearchModal.astro      # Pagefind Cmd+K search
│   ├── ThemeToggle.astro      # Dark/light toggle (localStorage 'cee406-theme')
│   └── react/
│       ├── stress/            # Stress Explorer app
│       ├── esal/              # ESAL Calculator app
│       └── tools.css          # Shared tool styling
├── data/
│   ├── homeworks.ts           # Single source of truth for all 10 homeworks
│   └── textbook.ts            # Chapter/appendix metadata
└── pages/
    ├── index.astro            # Landing page
    ├── 404.astro
    ├── homeworks/             # index + [id] dynamic route (10 pages)
    ├── textbook/              # index + [id] dynamic route (20 pages)
    └── tools/                 # index + tool pages

public/
├── homeworks/hw1..hw10/       # Assignment PDFs, handouts, data files
└── textbook/                  # ch01–ch13.pdf, appendix-a..g.pdf (~174 MB)
```

Source archives (`Chapters/`, `Homeworks Fall 2024/`) stay in Box and are gitignored; the site serves curated copies from `public/`. **Solution keys, student submissions, and exams are never published.**

---

## Adding next semester's homework

1. Edit `src/data/homeworks.ts` — everything (index, cards, pages, cross-links) regenerates from it.
2. Drop the new PDFs into `public/homeworks/hwN/`.
3. If the homework gets a tool, add the React island under `src/components/react/` and a page under `src/pages/tools/`.

---

## Deployment

Deployed automatically on push to `main` via `.github/workflows/deploy.yml` (same auto-detection scheme as ict-mechanics):

| Pages visibility | Base path | URL |
|------------------|-----------|-----|
| **Private** (default) | `/` | `https://<random>.pages.github.io/` |
| **Public** | `/CEE-406/` | `https://ictuillinois.github.io/CEE-406/` |

The workflow queries the GitHub API at build time and passes `PAGES_PUBLIC` to the Astro build; `astro.config.mjs` sets the base path accordingly. The first workflow run enables Pages automatically (`actions/configure-pages` with `enablement: true`).

```bash
# Switch visibility later
gh api repos/ictuillinois/CEE-406/pages -X PUT -f build_type=workflow --field public=true   # public
gh api repos/ictuillinois/CEE-406/pages -X PUT -f build_type=workflow --field public=false  # private
```

---

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `style:`, `ci:`
- **Components:** Astro for static UI, React islands (`client:only="react"`) for tools
- **Styling:** CSS variables in `global.css`, scoped `<style>` in Astro, `tools.css` for React
- **Links:** always use `import.meta.env.BASE_URL` for internal paths
- **Content:** homework/textbook content lives in `src/data/*.ts`, never hardcoded in pages
