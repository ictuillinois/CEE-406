# Figure 2.31 inspection

Reference: user-supplied `Handout_ThreeLayerSystem Plots.pdf`, three scanned pages containing panels (a)–(f). Compared all six panels with solver-generated meshes before and after the change, then inspected the actual Plotly rendering.

## Findings

- The coordinate transform and retained station values were sound. The defect was the **drawn parameter domain**. Selecting each curve’s longest tensile run continued it beyond the printed crest into overlapping branches. Even panel (e), with entirely positive station values, had these extra branches.
- The old endpoint test accepted any connection to another curve, including the extra branches. It could prove connectivity without proving the correct mesh.
- Independent row maxima are also insufficient: the printed shoulders in (d) and (f) are asymmetric. The endpoint stations are recorded explicitly for each reference panel. Sweep curves derive their starts from that same monotone boundary.
- Sparse Plotly splines introduced an additional, uncontrolled interpolation. The mesh now uses straight segments with adaptive refinement in log-ordinate space, preserving exact shared station vertices.
- Each factor previously calculated stresses at both interfaces although the figure only needs the bottom of layer 1. The new evaluator performs just that interface calculation. Cached evaluation and cooperative yielding remain in use.
- Browser inspection also exposed collapse to zero height when resizing a desktop chart to phone width. The reader now observes available width and redraws the existing mesh at the required aspect ratio.

## Retained endpoints

Each entry is the last A station for the H value in that column. Every sweep curve begins at the first H row retaining its A station.

| Panel | k1 | k2 | H=.125 | .25 | .5 | 1 | 2 | 4 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| a | 2 | 2 | .2 | .4 | .8 | 1.6 | 3.2 | 3.2 | 3.2 |
| b | 2 | 20 | .2 | .4 | .8 | 1.6 | 3.2 | 3.2 | 3.2 |
| c | 20 | 2 | .4 | .8 | 1.6 | 3.2 | 3.2 | 3.2 | 3.2 |
| d | 20 | 20 | .4 | 1.6 | 3.2 | 3.2 | 3.2 | 3.2 | 3.2 |
| e | 200 | 2 | .8 | 1.6 | 3.2 | 3.2 | 3.2 | 3.2 | 3.2 |
| f | 200 | 20 | 1.6 | 3.2 | 3.2 | 3.2 | 3.2 | 3.2 | 3.2 |

The reference has k2=2 and 20, not 3. Its panel (f) caption appears to repeat k2=2; the existing six-panel pairing and higher response identify the right-hand panel as k2=20.

## Verification and limits

Validation completed: 62 numerical/component tests passed; all six panels switched in Chromium without page errors; repeated 1440 → 390 → 1440 → 390 viewport changes preserved a visible chart; `npm run build` completed successfully, including Pagefind indexing.

- All 252 station factors from the single-interface evaluator exactly equal the full three-layer evaluator, including signed values outside the drawn domain.
- All six domains, both families’ endpoints, vertex ordering, custom-curve endpoints, and cache reuse are covered in `figure231.test.mjs`.
- Quarter-, midpoint-, and three-quarter-point checks bound segment error below 0.35 pixels for a 733.5-pixel-high, five-decade frame. This measures interpolation error against the numerical solver, **not** registration error against the scanned ink.
- Local mesh-generation measurements: approximately 0.17–0.28 seconds per cold panel, 4–7 milliseconds cached, before table prewarming adds the few omitted station evaluations. These exclude Plotly loading and painting and are not cross-device guarantees.
- The original scan is skewed and its curves are hand-drawn. The implementation retains computed values rather than displacing them to match individual ink pixels. Reference images and temporary comparison artifacts are not included in the published site.

Run the numerical and component checks with:

```sh
node --experimental-strip-types --test src/components/react/lea/figure231.test.mjs src/components/react/lea/charts.test.mjs src/components/react/lea/threeLayer.test.mjs src/components/react/lea/render.test.mjs
```
