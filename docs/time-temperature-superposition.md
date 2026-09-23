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
- On desktop the shift-factor panel is sticky and scrolls independently, with
  scroll chaining disabled so adjusting lower controls leaves the plot visible.
  Mobile retains normal page scrolling.

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

Final results fit the **Williams–Landel–Ferry** law to the student's saved log
shifts by equal-weight least squares. It changes neither the manual shifts nor
the sigmoid:

    log10(aT) = −C1 (T − Tref) / [C2 + (T − Tref)]

C1 (dimensionless) and C2 (°C) are reported beside the sigmoid parameters with the
shift-fit R². C1 enters linearly once C2 is fixed, so `fitShiftLaw` is a
one-dimensional search over C2 — a 400-point logarithmic scan followed by golden
section inside the bracket it finds — with C1 projected out in closed form at each
trial. There is no Jacobian and no seed to get wrong. The reference is satisfied
exactly (T = Tref gives log10 aT = 0) rather than fitted, so it contributes no
residual; constant shifts still have undefined shift-fit R².

Two bounds are reported rather than hidden, both through `atBound`:

- **The pole.** WLF is singular at `T = Tref − C2`. The search floor keeps that
  temperature below the coldest test temperature, which is the branch WLF is
  written for, and `shiftLawAt` returns NaN at or below it instead of a number —
  the predictor says so in words. The singular temperature is printed in the C2
  tooltip and carried in the export.
- **The straight line.** A straight line is the `C2 → ∞` limit at fixed C1/C2, so
  shifts with no curvature drive C2 to `WLF_C2_MAX` (10⁴ °C) and identify only the
  ratio. The card then says that only C1/C2 is determined, and prints it.

WLF needs three temperature groups; with two, C1 and C2 cannot be separated and
the card says so rather than fitting something else. Both constants belong to the
chosen reference. The WLF form converts exactly — moving the reference by ΔT gives
C2′ = C2 + ΔT and C1′ = C1C2/C2′ — but refitting at another reference anchors the
residuals elsewhere, so converting and refitting agree only as far as the fit is
good; `equations.test.mjs` pins the conversion on noiseless WLF data, where they
must agree exactly.

The predictor below the five plots evaluates the WLF law at the input temperature,
computes `log10(fr) = log10(f) + log10(aT)`, then evaluates the saved sigmoid to
return dynamic modulus magnitude in MPa. Frequency must be positive; both inputs
must be finite; temperatures at or below the pole report nothing. Predictions
beyond measured temperatures or the shifted frequency range are labeled
extrapolation. The exported JSON names the model and carries C1, C2, the
reference, the singular temperature and the bound flag, so a prediction can be
reproduced.

On the default trial shifts at a 21 °C reference the fit gives C1 = 23.03,
C2 = 197.6 °C (R² = 0.9996), which `equations.test.mjs` pins.

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
synthetic sigmoid recovery, exact WLF constant recovery at every reference and the
textbook reference conversion, the C2 → ∞ straight-line bound, the pole guard,
pivoted linear solves and NNLS, reference-script trial shift improvement, missing
overlap, and analytic standard-linear-solid relaxation and creep. Render tests exercise the manual entry state, full results and missing
phase data. Browser checks cover manual editing, dataset reference selection, invalid and
modulus-only imports, result invalidation, JSON export, all five plots, and mobile
layout. The catalog thumbnail is an actual browser capture at 1312 × 788.
