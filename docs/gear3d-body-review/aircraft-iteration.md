# Aircraft expansion and Aircrafter review

## Diagnosis

Reviewed `ict-mechanics/src/lib/aircrafter/database.ts`, its SVG gear renderer,
and `public/data/aircraft.xlsx`. The workbook has 413 rows, 284 nondeprecated.
It supplies FAARFIELD-derived main/belly wheel coordinates and loading data;
it does not supply complete nose gear, aircraft dimensions, or 3D airframe files.
Some rows are generic patterns, separate belly gears, or custom validation cases.
Blindly turning every row into a complete aircraft would invent geometry.

## Implemented

The live library grows from seven to thirteen aircraft:

| Added aircraft | Main wheels | Body |
| --- | ---: | --- |
| Boeing 787-8 / -9 / -10 | 8 each | AMV B787 family |
| Airbus A320-200 | 4 | AMV A320 family |
| Airbus A350-900 | 8 | AMV A350 family |
| Airbus A350-1000 | 12 | AMV A350 family |

The importer preserves reviewed spreadsheet coordinates, converts inches to mm,
and adds manufacturer nose gear and wheelbase. The A350-1000 instead uses Airbus's
footprint: 10.734 m track, 1.400 m tandem pitch, and 1.397/1.474/1.397 m axle
pitches. The spreadsheet has a 10.374 m track and omits the wider middle axle.
Its inherited `1400x530R23` tire is replaced by the published `50x20R22`.
The A350-900 inherited tire was independently confirmed. Main pressures for
A350-900 WV002 and 787-10 are updated from manufacturer tables.

MTOW and taxi weight remain distinct. The 95% main-gear allocation is declared
as a design assumption, rather than a measured center-of-gravity load split.
Airbus weight variants are A320 WV000, A350-900 WV002, A350-1000 WV000;
Boeing entries use the lower of the listed 787-9/-10 weight options.

The new A320/A350 assets retain source triangles and normals and load on demand.
For reviewed entries, uniform body scale and nose placement use manufacturer
length and nose-to-nose-gear dimensions. Family meshes remain illustrative:
variant-specific span, wing/engine stations, and vertical gear attachment are
not certified CAD dimensions. Existing 757/767/777 substitutions remain labeled.
Unknown aircraft no longer silently receive a 787 silhouette.

Resizing Quad view now refits its camera bounds while preserving zoom, pan,
orbit and perspective distance, avoiding clipping when moving to a narrow view.

## Evidence and reproduction

- [Coordinate audit and workbook hash](aircrafter-audit.json)
- [Pixel comparison metrics](pixel-comparison.json): A320 and A350, three views
  each, zero changed pixels and silhouette IoU 1 against the source mesh rendered
  with the same material/camera. This checks preparation fidelity, not accuracy
  against a real aircraft photograph or manufacturer CAD.
- A320: 5,229 triangles / 143,748 bytes; A350: 3,710 / 102,780 bytes.
- [Asset credits and modification statement](../../public/gear3d/bodies/CREDITS.md)

Run `python scripts/import-gear3d-aircrafter.py <aircraft.xlsx>` with openpyxl.
Rebuild body assets with `node scripts/build-gear3d-bodies.mjs <source-directory>`.
Run `node --test src/components/react/gear3d/*.test.mjs` and the browser checks
in `scripts/check-gear3d-aircraft.mjs` against the built app.

## Primary references

- [Boeing 787 ACAP Rev Q, October 2025](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_ACAP_Rev_Q.pdf): sections 2.1, 2.2 and 7.2.
- [Airbus A350 AC, December 2024](https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2024-12/AC_A350_1224.pdf): sections 2-1-0, 2-2-0 and 7-2-0.
- [Airbus A320 AC, December 2023](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-12/ac_a320_1223.pdf): sections 2-1-1, 2-2-0 and 7-2-0.
- [AMV aircraft models, CC BY 4.0](https://github.com/amvlab/aircraft-models).

## Further opportunities

Review A320 bogie, 737 MAX, regional and military rows individually. Irregular
footprints such as C-17 need arbitrary wheel coordinates; separate wing/belly
rows need manufacturer longitudinal offsets. Obtain licensed matching 757/767/777
meshes to remove the remaining representative substitutions. These are deferred
extensions, not entries hidden behind invented nose gear or family dimensions.
