# Software documentation

The Documentation tab uses the site's existing `DocsLayout` and typography.
Course guides live under `src/pages/documentation/`. Software navigation is in
`src/data/documentation.ts`.

## FAARFIELD source

Imported from the instructor-provided
`FAARFIELD-2.1.1/Documentation/Documentation.html`, generated from the FAA CHM help
by its accompanying `build_docs.py`. All 163 help topics are retained as reference
pages. Their technical prose is unchanged; the course guide is separately edited.
Images are decoded and deduplicated in `public/documentation/faarfield/`.
Cross-references become static routes. Standalone scripts, layout, and inline
formatting are removed. The original Box source is unchanged.

The importer converts consecutive numbered paragraphs into native ordered lists:
26 lists with 121 items across 16 topics. It requires at least two consecutive
numbers and preserves the starting number, inline markup, and technical body.
Figures and intervening prose end a list; isolated labels remain paragraphs.
Only the redundant plain-text list markers are removed. All 163 topic records,
825 links, 145 anchors, and 175 figure references were compared before and after;
their metadata, technical wording, link targets, and figure attributes match.

To reimport (Python with beautifulsoup4):

```powershell
python scripts/import-faarfield-docs.py 'C:/Users/johannc2/Box/05 Repositories/FAARFIELD-2.1.1/Documentation/Documentation.html'
```

The FAA download page listed 2.1.2 on October 1, 2026. The guide distinguishes
that release from the provided 2.1.1 help, which still contains 2.0 labels.

## WinJULEA draft

The first draft explains the layered elastic workflow, consistent units, wheel
contacts, evaluation points, output interpretation, sublayers, and checks. Its
practice case is independent of homework inputs. USACE's PCASE 2.09 manual
verifies the historical Utilities integration, not current installer availability.
No unverified standalone download URL is supplied.

The installed class version was not available for validation. Exact menu labels,
file formats, sign conventions, interface parameter definitions, and screenshots
need verification against that version. The guide asks students to verify output
conventions instead of assigning LEAPS conventions to WinJULEA.

## DRIP and Pavement ME

DRIP links to the Pavement ME resource page's DRIP 2.0 distribution and FHWA's
archived 2002 user guide. Its course workflow covers geometry, materials, inflow,
base drainage, separation, and collectors/outlets. Modern Windows installation
has not been tested.

Pavement ME links to the official product/licensing page and help topics for the
workflow, traffic, climate, and flexible materials. Access depends on the class
license and version; no institutional entitlement or account is assumed. The
guide covers trial designs, criteria/reliability, reports, and alternatives.
The commercial Manual of Practice is not copied. Resources checked October 1,
2026; version-specific interface screenshots should follow the class installation.

## Artwork and list polish

Software cards and sidebar links now use authentic supplied or published artwork.
FAARFIELD uses its configured FAA application icon; DRIP uses its manual cover
wordmark and window icon; Pavement ME uses its official 2026 product lockup and
square mark. WinJULEA uses its published historical splash artwork and associated
ERDC mark, explicitly distinguished from a verified standalone product logo.
Asset sources and extraction details are in
`public/documentation/branding/README.md`. Original proportions and colors are
retained; logos sit on light backgrounds in both themes.

All four course guides use numbered actions and supporting bullets, with two-level
feature, concept, assumption, and limitation lists. Declarative explanations are
not numbered as actions. Technical claims, citations, tables, section IDs, and
interactive widgets are preserved. Nested list spacing and markers follow the
site typography.

## Third iteration

Library cards add staggered entry and filter-position animations, fine-pointer
hover feedback, and inset keyboard outlines. Motion is disabled for reduced-motion
users. Software navigation has larger targets, a current-page rail, colored
monograms, and scrollable mobile tabs. Sidebar search is a native button; section
links preserve hashes and move keyboard focus.

The FAARFIELD guide now connects the imported theory, aggregate modulus procedure,
condition inputs, and four Appendix E examples to guided practice. Published
example results are explicitly distinguished from website verification runs.
The flexible example's 18.5/18.8-in. discrepancy and the rigid example's subgrade
CDF wording are flagged as documentation inconsistencies. The original manual
remains unchanged. The FAA README download could not be retrieved; current bugs
are not asserted without a verified release source.

WinJULEA adds response-grid, dual-wheel, and stiffness exercises, supported by
FHWA-HRT-15-063's explanation of layered elastic assumptions. DRIP adds manual
example replay and hydraulic sensitivity work, with the official NCHRP Appendix
TT as an alternate manual. Pavement ME adds baseline, layer-thickness, and input
uncertainty exercises. Its 2.6.1 fixes are sourced to official release notes and
clearly marked historical and resolved, alongside the February 2024 history.
None of these exercises supplies homework solutions or claims unperformed solver
validation. Installed software and current-version benchmark runs remain outside
the website checks.

Validation: production build and Pagefind indexing; all 169 documentation routes'
local links, figures, and fragments; 320/768/1024/1440-px light/dark layouts; filters,
manual search and URL restoration; checklist persistence/reset; print restoration;
figure keyboard dialog; site search; no-JavaScript access; reduced-motion behavior,
hover, sidebar keyboard search, section focus, and mobile active-tab visibility.
The release and math checks passed (14 tests).

## Second iteration

Each software entry now combines the course workflow with an explicit user's
manual section. FAARFIELD's 163-topic browser is embedded at `/documentation/faarfield/#manual`;
the former reference index redirects there, while existing topic URLs remain
valid. Search matches topic text and chapters; its query is kept in the URL.
Manual figures can be enlarged in a keyboard-accessible dialog.

Guides add focused mode/response selectors, callouts, and browser-saved checklists.
Their contents remain accessible without JavaScript. The software library adds
search, category filters, illustrated cards, and direct manual links; guide pages
add mobile section navigation and printing.

Source audit, October 1, 2026:

- FAA software page still lists 2.1.2; AC 150/5320-6G §3.12.9 verifies the CDF
  definition and lateral-strip interpretation. AC 150/5335-5D's FAA record links
  its January 2025 errata. Versioned help remains explicitly identified.
- The former PCASE 2.09 PDF URL now redirects to the PCASE 7 software page.
  WinJULEA's historical reference is described as such. No standalone WinJULEA
  manual or installer is claimed; exact class-version fields remain unverified.
- FHWA's record confirms DRIP's 2002 guide, FHWA-IF-02-053. Chapter 5 has worked
  examples and chapter 6 has sensitivity analysis. Modern Windows compatibility
  has not been tested.
- Pavement ME's official help verifies traffic factor totals and workflow;
  licensing is institution-dependent. The climate help endpoint returned 503
  during this check; the existing official URL is retained for a transient
  service issue, with the main User Help Manual as the alternative entry point.

Validation: production build with the locked dependencies in a clean temporary
copy; 14 release/math checks; all documentation links, image paths, and fragment
targets; light/dark browser checks at 320, 768, 1024, and 1440 px. Browser checks
cover library filters, decision selectors, manual search/chapter filtering and
query restoration, checklist persistence/reset, print expansion/restoration,
the legacy index redirect, figure dialog/Escape/focus return, site search, and
guide/manual access with JavaScript disabled.

## DRIP manual refinement — October 1, 2026

Reviewed the supplied `DRIP_manual.pdf` from the Lecture 6 Drainage materials:
114 PDF pages, FHWA-IF-02-053, July 2002. SHA-256:
`17100C44EC14FC8DEC3929D077C9E4D87B8E8971E12DC77B3A2BDCEE2CC500A4`.
The website links to FHWA's published PDF; the supplied file was not added to
the repository. Page links use physical PDF page numbers, while labels identify
printed chapter pages.

The guide now covers file/library handling, screen controls, flow-rate units,
porosity methods, separate hydraulic checks, collector discharge approaches,
all three worked examples, and sensitivity exercises. Published checkpoints are
identified as manual results; the Windows application was not run here.

Manual discrepancies are documented with source pages: the flow-length unit on
5-2; permeability and meltwater conflicts across 5-1, 5-4, and worked screens;
changed base density and fabric AOS in example 2 (figure 5-11 shows 0.075 in.,
while 5-12 proposes 1/6 in.); and the effective-porosity denominator in 4-3 versus
equations 4-10/4-13. These are not described as confirmed software defects.

Software logos now also appear in the mobile guide tabs. Browser validation
covers their visibility after navigation across all four guides and a FAARFIELD
manual topic, plus DRIP exercise disclosure, checklist persistence, and narrow
layouts. Production build, documentation link checks, and 14 release/math
checks pass.

## Guide navigation refinement — October 1, 2026

Guide pages now share a section jump menu, copy-page-link action, and section
permalinks. Jumping updates the URL and moves keyboard focus to the heading;
reduced-motion preferences disable smooth scrolling. An exercise control opens
or closes the practice disclosures without changing the manual browser. Guide
footers link to the next software guide, and library cards link directly to
practice as well as each user's manual.

Library searches and category filters persist in URL parameters and restore on
reload or history navigation. Without JavaScript, guides, exercise disclosures,
manual links, and section navigation remain accessible. Shared decision widgets
initialize on Astro page-load events without duplicate listeners.

Validation: production build; links, images, and fragments across all 169
documentation routes; light/dark layouts at 320, 768, 1024, and 1440 px; focused
browser checks for section focus, clipboard, exercise expansion, next-guide
navigation, filter restoration, and no-JavaScript access; 14 release/math checks.
