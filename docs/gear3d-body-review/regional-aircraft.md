# Regional aircraft: four more manufacturers

Six additions bring Gear3D to **25 named aircraft**: Embraer E170/E190,
Bombardier/Canadair CRJ700/900, De Havilland Canada Dash 8-400, and ATR 42-500.
FAA generic gear schematics remain separate and do not acquire a body.

## Reviewed configurations

All lengths are mm; pressures below are the selected manual's main-tire
pressure, not interchangeable service limits. Loads retain the explicitly
assumed 95% main-gear split. Manufacturer loading variants are selected
individually; taxi weight is never substituted for takeoff weight.

| Aircraft | MTOW / taxi weight | Wheelbase | Main track / pitch | Main tire | Pressure (psi) |
| --- | --- | ---: | --- | --- | ---: |
| E170 STD | 35990 / 36150 kg | 10620.000 | 5200.000 / 710.000 | H38x13-18 | 126.000 |
| E190 STD | 47790 / 47950 kg | 13830.000 | 5940.000 / 870.000 | H41x16-20 | 157.000 |
| CRJ700 | 72750 / 73000 lb | 15010.892 | 4114.800 / 622.808 | H36x12-18 | 142.000 |
| CRJ900 | 84500 / 85000 lb | 17299.178 | 4064.000 / 622.808 | H36x12-18 | 162.000 |
| Dash 8-400 (Q400) | 64500 / 64700 lb | 13944.600 | 8800.000 / 533.400 | 32x8.8-16 | 227.000 |
| 42-500 | 18600 / 18770 kg | 8781.000 | 4100.000 / 380.000 | 32x8.8R16 | 124.732 |

## Primary-document review and discrepancies

The reproducible input register is
[`regional-aircraft.json`](../../scripts/gear3d-body-assets/regional-aircraft.json).
The importer verifies one active workbook row per model and records original
wheel coordinates, manufacturer/category separation, source references, and
explicit geometry overrides in [`aircrafter-audit.json`](aircrafter-audit.json).
Manufacturer drawings supersede rounded or inconsistent workbook coordinates.

### Embraer E170 STD

[Embraer APM-1346 revision 17 (2015), manufacturer document mirrored by Manuals.plus: 2-2, 2-4 and 7-2 (PDF pages 28, 30, 98)](https://manuals.plus/m/73e2ca704565c0144f49d3e969038b577e658def993378e8434885c70ffdd746.pdf).

- Missing tires supplied from the APM. Nose 24x7.7 is normalized with its 10-inch rim from the Goodyear databook.
- Manufacturer track/pitch 5200/710 mm supersede rounded workbook 5207/711.2 mm.
- Wheelbase uses pavement footprint 10.62 m; general drawing instead gives 10.60 m.

Body placement: Length and nose overhang: APM Figure 2.1; tail height: Table 2.3, STD forward CG at ramp weight. Rigid visual placement; no CG-dependent pitch simulation. Strut tops visually calibrated to the prepared body; these are illustrative attachments, not manufacturer strut dimensions.

### Embraer E190 STD

[Embraer APM-1901 revision 24 (2024), Section 02 pages 2 and 4; Section 07 page 2 (PDF pages 16, 18, 114)](https://www.embraer.com/media/jwsj1u1u/e190apm_apm_190-1.pdf).

- Missing tires supplied from the APM. Nose 24x7.7 is normalized with its 10-inch rim from the Goodyear databook.
- Manufacturer track/pitch 5940/870 mm supersede workbook 5943.6/863.6 mm.
- Main pressure 147 -> 157 psi from the current footprint; older pavement charts have different pressures.

Body placement: Length and nose overhang: Figure 2.1. Tail height 10.57 m from Figure 2.1; rigid visual placement. Strut tops visually calibrated to the prepared body; these are illustrative attachments, not manufacturer strut dimensions.

### Bombardier / Canadair CRJ700

[Bombardier CSP B-020 revision 15 (2015): 00-02-01 page 1, 00-02-02 page 3, 00-07-01 page 6 (PDF pages 25, 31, 136)](https://customer.aero.bombardier.com/webd/BAG/CustSite/BRAD/RACSDocument.nsf/51aae8b2b3bfdf6685256c300045ff31/ec63f8639ff3ab9d85257c1500635bd8/$FILE/ATTE8Q23.pdf/CRJ700APMR15.pdf).

- Missing tires supplied from the APM. Manufacturer 162-inch track supersedes the workbook 160.18-inch track.
- Body length uses revised drawing 1278.8 inches, rather than older table 1273.2 inches. CRJ program originally Bombardier/Canadair; current support is MHIRJ.

Body placement: Length/height: revised general drawing. Nose overhang is an illustrative 1.73 m mesh placement, not a verified nose station. Strut tops visually calibrated to the prepared body; these are illustrative attachments, not manufacturer strut dimensions.

### Bombardier / Canadair CRJ900

[Bombardier CSP C-020 revision 11 (2015): 00-02-01 page 2 (aircraft 15036-15990), 00-02-02 page 3, 00-07-01 page 6 (PDF pages 26, 31, 162)](https://customer.aero.bombardier.com/webd/BAG/CustSite/BRAD/RACSDocument.nsf/51aae8b2b3bfdf6685256c300045ff31/ec63f8639ff3ab9d85257c1500635bd8/$FILE/ATTQF1EY.pdf/CRJ900APMR11.pdf).

- Missing tires supplied from the APM. Manufacturer 160-inch track supersedes workbook 160.18 inches.
- Wheelbase follows dimensioned footprint 681.07 inches; inherited FS228.40/FS819.38 labels on that figure do not reproduce it. CRJ program originally Bombardier/Canadair; current support is MHIRJ.

Body placement: Length/height: general drawing. Nose overhang is an illustrative 1.73 m mesh placement, not a verified nose station. Strut tops visually calibrated to the prepared body; these are illustrative attachments, not manufacturer strut dimensions.

### De Havilland Canada Dash 8-400 (Q400)

[De Havilland PSM 1-84-13 (March 2022), Chapter 2 pages 3, 5, 8; Chapter 7 page 2 (PDF pages 29, 31, 34, 152). High gross weight, standard main tires; loaded pressure.](https://dehavillandportal.com/assets/public-documents/D8400-APM.pdf).

- Workbook combines optional 19.54-inch spacing with standard 227 psi pressure. Standard 32x8.8-16 tires require 21-inch spacing; both main units corrected.
- Track uses manufacturer 8.80 m rather than workbook 8.7884 m. Wheelbase uses 45 ft 9 in = 13.9446 m; general drawing incorrectly converts that to 13.99 m.
- Six-blade propellers remain static.

Body placement: Tail/nacelle/fuselage heights from Chapter 2 page 8, forward CG at ramp weight. Nose overhang is an illustrative 1.8 m mesh placement. Gear attachments approximate the documented lower surfaces.

### ATR 42-500

[ATR 42-400/500 Aircraft Characteristics, PIA fleet 45: 2.1 page 2 (2025); 2.3 pages 1-2; 7 page 6 (2020). PDF pages 54, 59-60, 204. Standard 32x8.8R16 tires.](https://crewserver1.piac.com.pk/Documents/Manual/ATR42/PK1.AC.45.L.SI.full.Rev2.0.pdf).

- Missing tires supplied from manufacturer footprint; standard main tire pressure is 8.6 bar, replacing workbook 0.83 MPa. Optional H34x10R16 tires are not mixed into this configuration.
- Selected current structural taxi/takeoff weights 18770/18600 kg; older pavement curves label 18600 kg as ramp weight.
- Source mesh has an over-wide outer wing. Only geometry outboard of the propellers is span-corrected; source fuselage, nacelles and propellers are retained.

Body placement: Length/nose overhang/tail height: 2.3 ground-clearance drawing and table, ramp weight forward CG. Strut attachments are illustrative. Outer wing span corrected to 24.572 m in preparation; central body and nacelles preserved. Strut tops visually calibrated to the prepared body; these are illustrative attachments, not manufacturer strut dimensions. Main strut tops lean 0.5 m inboard into the source sponsons; wheel centers are unchanged.

The E170 document is a mirror of the manufacturer-authored manual; its old
manufacturer URL was unavailable. ATR's manufacturer-authored manual is hosted
by operator PIA. Neither mirror is presented as a manufacturer-hosted resource.
Embraer nose-tire rim normalization is supported by the
[Goodyear Aviation Databook 2022](https://www.goodyearaviation.com/resources/pdf/Aviation-Databook-2022.pdf).

## Geometry, licensing and performance

All six meshes come from the FlightGear/FGMEMBERS aircraft distributed in
[Flightradar24's GPLv2 collection](https://github.com/Flightradar24/fr24-3d-models),
pinned to commit `dd53267690c6a4ecbb290a3acf0284333a5d68a9`.
Original GLBs, editable Blender files, upstream ZIPs, README and license are
shipped in per-model source archives. Hashes are in the
[source manifest](../../public/gear3d/bodies/sources/manifest.json);
[credits](../../public/gear3d/bodies/CREDITS.md) link each archive and upstream project.
Source archives are never fetched by the renderer.

The preparation removes textures and named gear surfaces, retains static
six-blade propellers, and merges surfaces without triangle simplification.
The ATR source's excessive outer span is corrected beyond 6 source units from
the centerline, outside the nacelles and propellers. It has a 24.572 m span at
22.67 m length after correction; no central airframe geometry is warped.
Original input meshes remain archived unchanged. Other source proportions are
retained, and small family-mesh discrepancies remain illustrative.

| Body | Triangles | Bytes | Body draw calls |
| --- | ---: | ---: | ---: |
| E170 | 19812 | 405720 | 1 |
| E190 | 20288 | 421728 | 1 |
| CRJ700 | 14451 | 349716 | 1 |
| CRJ900 | 14947 | 363116 | 1 |
| DHC8-400 | 13161 | 327076 | 1 |
| ATR42 | 23795 | 496924 | 1 |

Ground attitude uses a documented reference tail height for CRJs, both E-Jets and
both turboprops. It is rigid visual placement, not a CG or suspension simulator.
Dash 8 main struts reach nacelles; ATR strut tops lean 500 mm inboard
to meet the source sponsons. Nose attachments are calibrated to the prepared
body openings, avoiding detached legs.
These strut heights are explicitly illustrative and do not move tire footprints.
CRJ and Dash 8 nose overhangs remain declared visual assumptions.

## Reproduction and checks

1. Extract each archive's `models/<model>.glb` into the source directory as
   `fr24-<model>.glb`.
2. Run `scripts/convert-gear3d-fr24.mjs` with gltf-pipeline 4.3.1.
3. Run `node scripts/build-gear3d-bodies.mjs <source-dir> E170 E190 CRJ700 CRJ900 DHC8-400 ATR42`.
4. Run `python scripts/import-gear3d-aircrafter.py <aircraft.xlsx>`.
5. Run `node --test src/components/react/gear3d/*.test.mjs`, the production build,
   and `scripts/check-gear3d-aircraft.mjs <preview-url>`.

Eighteen side/top/perspective pixel comparisons compare the prepared source
(including the declared ATR span correction) against its exported GLB with
identical cameras, lighting and materials. They test conversion fidelity, not
agreement with photographs or manufacturer CAD. All report zero changed pixels.
Tests also check manufacturer mapping, documented corrections, tire geometry,
load conservation, body bounds/ground clearance, ATR span, turboprop attachment
heights, and exclusion of bodies from engineering exports.

## Further candidates

Cessna Citation II and Piper PA-28 remain attractive single-wheel additions,
but the workbook's combined Citation II/Bravo entry and PA-28 Arrow variant
need exact variant matching and original footprint data. BAe 146, Saab,
Fokker, Dassault and Gulfstream need equally complete source pairs.
ATR72 is not represented by stretching the ATR42 mesh. These unverified
candidates remain outside the published library.

Final checks: 48 regression tests pass; production build indexes 33 pages.
All 18 reviewed aircraft load in the production browser without page errors.
New manufacturer groups are present, and new families fit Quad views at
320 px, 768 px and 1024 px without horizontal page overflow.
A browser save/open roundtrip also preserves ATR source metadata, body calibration, wheel coordinates and loads.
