# HW2 fitter tools

Both tools are released at `/tools/mr-fitter/` and `/tools/cbr/`. The HW2 page itself remains under its existing release gate. The tools contain the user-authorized datasets, not a copy of the assignment PDF.

## Data and student decisions

The presets reproduce the Fall 2026 HW2 PDF: 30 triaxial readings and eight penetration/pressure readings. The resilient-modulus preset preserves every reported value. Nothing is excluded, classified as an outlier, or fitted on first load. The CBR preset starts at zero origin correction with no tangent region selected and no computed CBRs.

- Students choose and fit the generalized or two-parameter bulk-stress model. Both fit results remain available for a prediction comparison until the observations or atmospheric pressure change.
- Reading IDs survive exclusions. Rows can be edited, excluded/restored (MR), removed, added, or replaced with pasted numeric data. Invalid entries are identified, not silently accepted as zeros.
- Residual plots and calculation tables support investigation; the tool does not choose the outliers or identify the maximum model divergence.
- Prediction requires bulk stress and deviator stress. A prescribed bulk stress alone leaves the generalized model’s octahedral shear term unspecified. Inputs must give nonnegative confinement. Both predictions, when available, use the same entered state; their signed difference is reported in psi and percent relative to the bulk model.
- CBR tangent exploration fits only the region the student selects. Two readings give a secant approximation; a larger region uses a least-squares line. Viewing another tangent does not change the applied origin. Using its intercept requires a separate action, or the student can type a correction.
- Each CBR calculation requires chosen adjacent readings (or one exact reading used twice) and a positive standard pressure. The corrected target is mapped back to measured penetration before interpolation. No pressure extrapolation, automatic tangent selection, or governing-CBR answer is supplied.

## Numerical and visual implementation

MR regression minimizes squared natural-log response residuals using standardized, reorthogonalized QR least squares. It reports both log-space and original-modulus R² and rejects insufficient or rank-deficient designs. The input unit is kPa, and the preset atmospheric pressure is 101.325 kPa. The bulk-model coefficient is unit dependent; prediction results convert to psi with 6.894757293168 kPa/psi.

CBR pressures remain in psi and penetrations in inches. The complete measured/corrected penetration worksheet retains negative corrected penetrations. Results are invalidated when their inputs change. The current teaching UI uses the explicit bracket functions; the pre-existing automatic reduction API is retained for compatibility but is not used by the tool.

Equations use the same `Equation`/KaTeX renderer as Layered Elastic Analysis. Charts use the shared Plotly theme and legends. The miniature WebP files show initial data views at 1312×788, without worked assignment answers.

## Checks

```sh
node --experimental-strip-types --test src/components/react/fitting/equations.test.mjs src/components/react/fitting/render.test.mjs src/components/react/cbr/equations.test.mjs src/components/react/ui/math.test.mjs src/data/release.test.mjs
npm run build
```

The numerical checks include independent NumPy least-squares reference values, synthetic known-parameter recovery, stress-unit consistency, singular fits, residual signs, CBR interpolation and tangent selection, and malformed imports. All 30 MR rows were checked directly against PDF extraction.

With Python Playwright and Chromium installed, run the interaction checks against a local dev or preview server:

```sh
python scripts/check-hw2-fitters.py --base-url http://127.0.0.1:4324
```

This checks initial unanswered states, fitting both models, prediction, exclusion/reset, pasted data, tangent choices, correction application, bracket validation, result invalidation, mobile resizing, dark mode, and browser errors.

## Fitter chart refinements

Both axes use high-contrast labels and restrained major/minor grids. Raw stress response is the default. The generalized model displays one continuous confinement curve per included group, all evaluated from the same jointly fitted k1, k2, k3. The HW2 preset has five nominal groups: 20.68, 34.47, 68.95, 103.42, and 137.90 kPa. Curve colors match the markers; marker shapes also distinguish groups. These colors persist in the normalized view and residual plot and remain stable when a group is excluded. Curve portions outside the corresponding group's measured range are explicitly described as model projections.

A visible display-only checkbox groups the recorded 104.11-kPa reading with nominal 103.42 kPa. Its hover text identifies both pressures; regression and worksheet values always retain the recorded stress. Turning grouping off shows six exact stress levels without refitting. Other custom pressures are shown as distinct groups. The optional shear-normalized view divides each modulus by `(1 + tau_oct/pa)^k3` to show one continuous power curve `k1 pa (theta/pa)^k2`. The bulk model retains one raw power curve with markers colored by confinement.

The model form was checked against [FHWA NHI-05-037, Chapter 5](https://www.fhwa.dot.gov/engineering/geotech/pubs/05037/05b.cfm). All three generalized coefficients are estimated jointly using log-space QR least squares. Independent reference coefficients, synthetic parameter recovery, unit consistency, and preservation of log residuals after shear normalization are tested. Curve sampling evaluates the equation directly at 401 points, with Plotly simplification disabled; it does not interpolate or smooth observations.

Prediction controls sit immediately below Stress response. Entering a valid state adds both available models' markers, dashed constant-confinement paths, and horizontal/vertical reading guides. In the normalized view, guides and both models’ markers share the selected generalized shear adjustment; hover text and tables retain the actual prediction. CBR uses blue measured and green corrected curves, and a violet dashed tangent clipped to the full plotting window. Origin correction precedes the penetration worksheet, followed by the CBR input/result tables; reading choices show both measured and corrected penetration. Changing the correction invalidates results so students can choose the new brackets and recompute.

Regenerate both raw-data miniatures after a build with `python scripts/capture-fitter-miniatures.py --base-url http://127.0.0.1:4326`. The script captures the actual light-theme pages and encodes them as WebP; no fit, exclusion, or CBR answer is selected.
