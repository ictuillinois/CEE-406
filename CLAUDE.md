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

- **Content lives in `src/data/homeworks.ts` and `src/data/textbook.ts`** — pages under `src/pages/homeworks/[id].astro` and `src/pages/textbook/[id].astro` are generated from them. To change homework content, edit the data file, not the page.
- React tools are islands mounted with `client:only="react"` (Plotly is browser-only; do not SSR them). Each tool: `src/components/react/<tool>/App.tsx` + shared `src/components/react/tools.css` + a wrapper page in `src/pages/tools/<tool>/index.astro`.
- Always build internal links with `import.meta.env.BASE_URL`.
- Theme key is `localStorage('cee406-theme')`; `[data-theme="dark"]` overrides live in `global.css`.
- KaTeX auto-renders `$...$` inside elements when the page has `.doc-equation` or `[data-katex]`.
- Signature visual: pavement cross-section motif — `PavementHero.astro` (canvas), `LayerGlyph.astro` (per-HW glyph), footer layer-rule. Keep new UI consistent with it.

## Content policy (IMPORTANT)

- `Chapters/` and `Homeworks Fall 2024/` at the repo root are **gitignored Box source archives**. The site serves curated copies from `public/textbook/` and `public/homeworks/`.
- **Never publish**: solution keys (`*Key*`, `*solutions*`), graded student submissions (e.g. `Lara Diab`), or exams (`Final Exam*`). When adding new semester materials, copy only assignments, handouts, references, and data files.
- Textbook PDFs are for enrolled students; the site is intended to run on **private** GitHub Pages.

## Deployment

- Push to `main` → `.github/workflows/deploy.yml` → GitHub Pages.
- The workflow auto-detects Pages visibility (`gh api .../pages --jq '.public'`) and sets `PAGES_PUBLIC` for the build:
  - private (default): `base: '/'`
  - public: `base: '/CEE-406/'`, site `https://ictuillinois.github.io`
- First run enables Pages via `actions/configure-pages@v5` with `enablement: true`.
- Before changing anything deployment-related, check current visibility:
  `gh api repos/ictuillinois/CEE-406/pages --jq '{public, html_url}'`

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `style:`, `ci:`).
- Astro for static UI; React only for interactivity.
- Tool engineering references belong in the tool header/notes (e.g., "Huang Eqs. 2.1–2.6", "AASHTO 1993 App. D") so students can verify formulas.
