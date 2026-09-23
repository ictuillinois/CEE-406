# Time-Temperature Superposition

Route: `/tools/time-temperature-superposition/`. The tool is released in the shared
catalog and release gate. React island: `src/components/react/tts/TtsApp.tsx`.

## Teaching workflow

- Start with 30 unshifted measurements grouped by five temperatures. Edit rows,
  paste delimited data, or import CSV. Imports validate before replacing active data.
- Students adjust one signed `log10(aT)` per temperature. There is no shift optimizer.
  The reference is anchored at zero. Every response at a temperature uses that shift.
- Live feedback uses `1 − R²` in log-modulus space: minimize toward zero. R² is
  also shown, with neighboring overlap coverage retained as an independent check.
  Saved attempts use this same error; residual tables report mean absolute percentage error.
- Students explicitly capture a final fit. Editing data, shifts, reference or the
  equilibrium modulus invalidates that capture. Export includes inputs and shifts.

## Source and units

Default data are from Johann J. Cardenas's `Prony_Mix 1.py`, updated 2023-12-17,
PG 64-22 (M1 R27-233). The source was supplied from the instructor's local Box archive.
`data.ts` preserves three replicate arrays for each response and averages modulus
and phase independently, exactly as that script does. The modulus arrays are MPa;
the earlier ksi comment in the Python file is inconsistent with its actual data.
Students see a single 30-point dataset, with one mean modulus and mean phase angle
per temperature/frequency pair. Replicate arrays are provenance, not selectable datasets.

The interface keeps reminders short and places explanations in the shared information
tooltips. Charts use the shared fitter axes, major/minor grids, temperature-specific
symbols with contrasting borders, and thicker model lines behind the measurements.

CSV columns: `temperature_C,frequency_Hz,modulus_MPa,phase_deg`. The phase column
may be omitted or blank. Modulus-only data support shifting and sigmoid fitting;
at least six phase readings are needed to fit the supplemental response spectrum.
All frequencies shown are Hz. Angular frequency is explicitly `2πf` internally.

## Models

`equations.ts` imports no React. The sigmoid uses base-10 logarithms and a natural
exponential: `log10|E*| = δ + α / (1 + exp(β + γ log10 fr))`. Variable projection
solves the two plateaus for each trial center/slope. Plateaus are bounded within
two decades outside the data; a bound hit is surfaced. Only model parameters are
optimized, never student shifts.

The reference selector lists only temperatures in the active dataset, including imported
values. Changing reference subtracts its log shift from every shift, preserving
pairwise spacing and fit error. The selected reference is fixed at zero.

The final supplemental model follows the Python workflow: storage and loss from
measured magnitude/phase, fitted jointly with nonnegative relaxation strengths.
NNLS uses absolute MPa residuals (scaled uniformly for conditioning); the
internal diagnostics are log RMSE; the UI uses dimensionless fit error. Twenty logarithmically spaced relaxation times adapt to
the shifted frequency range, so changing reference translates their scale without
changing the material fit. E∞ defaults to the script's 1 MPa (or a smaller value for
soft imported data) and is editable. The sigmoid and relaxation-spectrum fits are
different models and are labeled separately.

Time-domain plots are omitted from the final tab. The numerical relaxation/creep
utilities remain tested independently. The five final charts show dynamic modulus,
shift factors, storage modulus, loss modulus and phase angle.

## Verification

Run:

```sh
node --experimental-strip-types --test src/components/react/tts/*.test.mjs
node --experimental-strip-types --test src/data/release.test.mjs src/components/react/ui/math.test.mjs
npm run build
```

Tests cover source averages, import validation, shift/reference invariance,
synthetic sigmoid recovery, pivoted linear solves and NNLS, reference-script trial
shift improvement, missing overlap, and analytic standard-linear-solid relaxation
and creep. Render tests exercise the manual entry state, full results and missing
phase data. Browser checks cover manual editing, dataset reference selection, invalid and
modulus-only imports, result invalidation, JSON export, all five plots, and mobile
layout. The catalog thumbnail is an actual browser capture at 1312 × 788.
