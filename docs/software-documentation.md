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
