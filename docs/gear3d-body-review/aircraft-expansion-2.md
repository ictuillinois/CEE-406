# Aircraft expansion: detailed manufacturer and mesh review

This iteration adds six complete configurations, increasing the named library
from 13 to 19. Seven matching body assets replace generic silhouettes for the
new aircraft and the existing Boeing 777-300ER entry.

## Reviewed geometry and loading variants

All distances below are wheel-center distances in millimeters. They are not
outside-of-tire widths. Main-wheel coordinates are independently checked against
the Aircrafter workbook and retained without rounding in the generated JSON.

| Aircraft | Selected MTOW | Wheelbase | Main track | Main tire | Body |
| --- | ---: | ---: | ---: | --- | --- |
| A319-100 WV000 | 64,000 kg | 11,039 | 7,590 (rounded) | 46x17R20 | A319 |
| A321-200 WV000 | 89,000 kg | 16,906 | 7,590 (rounded) | 1270x455R22 | A321 |
| A330-200 WV020 | 230,000 kg | 22,180 | 10,680.7 | 1400x530R23 | A330-200 |
| A330-300 WV020 | 230,000 kg | 25,375 | 10,680.7 | 1400x530R23 | A330-300 |
| A220-100 | 140,500 lb | 13,106.4* | 6,731 | H42x15.0R21 | CS100 / A220-100 |
| A220-300 | 156,300 lb | 15,306.04* | 6,731 | H42x15.0R21 | CS300 / A220-300 |

Nose tire/pitch: A319/A321 `30x8.8R15`, 500 mm; A330 `1050x395R16`,
710 mm; A220 `27x8.5R12`, 471.678 mm. A330 tandem pitch is 1,981.2 mm
and main dual pitch 1,397 mm. Airbus rounds the tandem pitch to 1.981 m and
publishes a 10.684 m track; the small difference from the workbook's 10.6807 m
is retained and documented, rather than conflating inside/outside dimensions.

The A330 general-dimension diagram also shows nose-to-main-gear distances.
Those must not be mistaken for nose-gear-to-main-gear wheelbases: use the
22.180 / 25.375 m dimensions on the footprint figures. Body nose overhang is
6.67 m. A319/A321 body nose overhang is 5.07 m.

### Corrections and unresolved discrepancies

- **A321:** the workbook inherits the A320 `46x17R20` tire. Airbus's A321-200
  footprint specifies `1270x455R22`; this correction changes the displayed
  tire diameter and section width.
- **A220:** workbook tire designations are empty. The manufacturer supplies
  nose and main sizes. Updated pressure tables state 200 psi (-100) and
  223 psi (-300), and the selected manufacturer MTOW/taxi-weight pairs replace
  the older workbook loading variants. Taxi weights are 141,500 / 157,000 lb.
- **A220 wheelbase conflict (*):** the general aircraft drawings state 43 ft
  (-100) and 602.6 in (-300). The pavement module's footprint drawings state
  513.10 / 576.10 in instead. An older footprint table additionally gives
  42.98 / 49.98 ft. This is an unresolved discrepancy within the publication.
  The visualization uses the general-dimension drawings, explicitly records
  the conflict in `assumedFields`, and includes the alternatives in its notes.
  Do not treat these entries as independently verified pavement geometry.
- All aircraft continue to declare the **95% main-gear load split as a design
  assumption**. It is not a weight-variant-specific measured CG position.

## Primary sources examined

- [Airbus A319 AC, July 2026](https://mediaassets.airbus.com/pm_38_916_916263-0hxcf0237y.pdf?fileName=aca31901-jul-2026-2.pdf): 2-1-1 page 1; 2-2-0 pages 2–3; 7-2-0 page 2.
- [Airbus A321 AC, July 2026](https://mediaassets.airbus.com/pm_38_916_916230-7u6neg4lfg.pdf?fileName=aca32101-jul-2026.pdf): 2-1-1 weight tables; 2-2-0 pages 2–3; 7-2-0 page 3.
- [Airbus A330 AC, December 2025](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-12/AC_A330_20251201.pdf): 2-1-1 pages 2 and 7; 2-2-0 pages 2–5; 7-2-0 pages 2, 6 and 7.
- [Airbus A220 ACP issue 013, November 2025](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-12/A220-ACP-Issue013-00-27Nov2025.pdf): aircraft-description modules `12AAA` pages 3, 6 and `12AAB` pages 3–8; pavement modules `11AAA` pages 86–87 and `11AAB` pages 63–64; footprint module `J06-10-32` pages 1–3. PDF pages are 73, 76, 109–114, 542–543, 609–610, and 613–615, respectively.
- [Aircrafter coordinate audit](aircrafter-audit.json): workbook hash, row numbers,
  raw main-wheel coordinates, and corrections for all twelve imported entries.

## Model research and conversion

The [Flightradar24 aircraft repository](https://github.com/Flightradar24/fr24-3d-models)
provides distinct aircraft geometries and links their FlightGear/FGMEMBERS origins.
Its aircraft models use GPL v2. Editable Blender files, upstream source ZIPs,
original glTF files and the license are included in downloadable per-model
[source archives](../../public/gear3d/bodies/sources/manifest.json).
See [credits](../../public/gear3d/bodies/CREDITS.md) for author/project links.

The old binary glTF 1 files cannot load directly through current Three.js.
`scripts/convert-gear3d-fr24.mjs` verifies input hashes and converts them with
gltf-pipeline 4.3.1. The existing browser bake then removes textures and named
gear nodes, bakes transforms, and combines body surfaces into one draw call.
No triangle simplification is used. Conversion keeps source shape and normals;
runtime bodies remain illustrative, not manufacturer CAD. The 777-300 mesh is
a closer family match for the 300ER than the previous 787 substitute, but its
engine and wing geometry is not claimed to be a precise 300ER model.

| Body | Triangles | GLB bytes |
| --- | ---: | ---: |
| A319 | 21,849 | 993,752 |
| A321 | 23,189 | 953,052 |
| A330-200 | 16,774 | 365,604 |
| A330-300 | 17,984 | 389,184 |
| A220-100 | 25,464 | 724,348 |
| A220-300 | 21,532 | 591,768 |
| B777 | 23,729 | 540,412 |

Triangle totals count instantiated geometry, which may differ from the number
of primitives in an input file that shares meshes. Each prepared body is below
30,000 triangles and 1 MB, loaded only when selected. Editable source archives
are never loaded by the viewer.

## Validation

Side, top and perspective comparisons are recorded in `pixel-comparison.json`
and the new PNG sheets. They compare the prepared source body with the exported
GLB under identical rendering conditions, not against aircraft photographs.
Geometry tests check finite vertices, ground clearance, load conservation,
source wheel coordinates, correct family mapping, and one body draw call.
The production browser check selects every reviewed aircraft and checks mobile
Quad framing. The full app build and regression suite are also run.

Reproduce the inputs by extracting each archive's `models/<id>.glb` as
`fr24-<id>.glb` into the source directory, running `convert-gear3d-fr24.mjs`,
then `build-gear3d-bodies.mjs`. The importer remains
`python scripts/import-gear3d-aircrafter.py <aircraft.xlsx>`.

## Research candidates remaining

The same model collection includes CRJ700/900, E170/190, ATR42 and matching
757/767 bodies. Those are useful next families, but need their own manufacturer
footprints and tire verification. A330neo and A321neo/XLR require variant-specific
wing/engine and weight choices; this iteration avoids silently relabeling older
meshes as those variants.
