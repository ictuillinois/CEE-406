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
