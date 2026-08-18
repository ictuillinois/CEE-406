// Tests for FWD backcalculation. Run with:
//   node --experimental-strip-types --test src/components/react/backcalc/equations.test.mjs
//
// The AASHTO route is checked against the printed answers of Huang (2004)
// Example 13.11, p. 638. The layered-elastic route is checked by round trip:
// a basin is generated forward from known moduli, then those moduli must be
// recovered from the basin alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  subgradeMr, designMr, effectiveEp, snEff, minSensorOffset, d0Odemark,
  aashtoNdt, basin, basinIndices, backcalculate, temperatureFactor, isDetermined,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* ───────────────────── AASHTO 1993, Huang Example 13.11 ─────────────────── */
// P = 9000 lb, a = 5.9 in, d0 = 0.0139 in at 80°F, dr = 0.00355 in at r = 36 in,
// AC 4.25 in over 8 in granular base, so D = 12.25 in.

test('Eq. 13.22 — subgrade modulus from the outer sensor', () => {
  const mr = subgradeMr(9000, 0.00355, 36);
  near(mr, 16900, 0.005, 'M_R backcalculated');       // book: 16,900 psi
  near(designMr(mr, 0.33), 5580, 0.01, 'design M_R'); // book: 5580 psi
});

test('Eq. 13.25 — effective modulus of the layers above the subgrade', () => {
  // The book applies a temperature factor of 0.92 to d0 first.
  const d0 = 0.92 * 0.0139;
  near(d0, 0.0128, 0.01, 'temperature-adjusted d0');
  const q = 9000 / (Math.PI * 5.9 ** 2);
  near(q, 82.3, 0.005, 'plate pressure');

  const Ep = effectiveEp(d0, q, 5.9, 12.25, 16900);
  // The book reads Ep/MR ≈ 8.5 off Figure 13.17 (a chart read to one decimal),
  // giving Ep = 143,650 psi. Solving Eq. 13.25 exactly lands in the same place.
  near(Ep / 16900, 8.5, 0.12, 'Ep/M_R');

  // Round trip: the Ep we solved for must reproduce the d0 we started from.
  near(d0Odemark(q, 5.9, 12.25, 16900, Ep), d0, 1e-6, 'd0 round trip');
});

test('Eq. 13.26 — effective structural number', () => {
  near(snEff(12.25, 143650), 2.88, 0.01, 'SN_eff');   // book: 2.88
});

test('Eq. 13.24 — minimum sensor offset', () => {
  near(minSensorOffset(5.9, 12.25, 8.5), 17.98, 0.01, 'r_min');  // book: 17.98 in
});

test('the whole AASHTO NDT route agrees with the worked example', () => {
  const r = aashtoNdt(9000, 5.9, 0.92 * 0.0139, 0.00355, 36, 12.25, 0.33);
  near(r.mrBackcalculated, 16900, 0.005, 'M_R');
  near(r.mrDesign, 5580, 0.01, 'design M_R');
  near(r.snEff, 2.88, 0.05, 'SN_eff');
  assert.equal(r.sensorFarEnough, true, '36 in clears the 18 in minimum');
});

test('a sensor placed too close is flagged', () => {
  // Same section, but reading the subgrade off a sensor at 12 in.
  const r = aashtoNdt(9000, 5.9, 0.0128, 0.0080, 12, 12.25, 0.33);
  assert.equal(r.sensorFarEnough, false);
});

/* ───────────────────────── Layered-elastic route ────────────────────────── */

const OFFSETS = [0, 8, 12, 18, 24, 36, 60];

test('backcalculation recovers the moduli it generated the basin from', () => {
  const truth = [
    { h: 4, E: 400000, nu: 0.35 },
    { h: 8, E: 30000, nu: 0.35 },
    { h: 0, E: 12000, nu: 0.40 },
  ];
  const q = 80, a = 5.9;
  const measured = basin(truth, q, a, OFFSETS);
  assert.ok(measured, 'forward basin computed');

  // Start two to three times away from the truth in every layer.
  const seed = [
    { h: 4, E: 150000, nu: 0.35 },
    { h: 8, E: 60000, nu: 0.35 },
    { h: 0, E: 6000, nu: 0.40 },
  ];
  const fit = backcalculate(seed, q, a, OFFSETS, measured, { tolPct: 0.05 });
  assert.ok(fit, 'fit returned');
  assert.ok(fit.rmsPct < 0.5, `basin matched to ${fit.rmsPct.toFixed(3)}% RMS`);
  near(fit.E[0], 400000, 0.10, 'AC modulus');
  near(fit.E[1], 30000, 0.10, 'base modulus');
  near(fit.E[2], 12000, 0.03, 'subgrade modulus');
});

test('the subgrade is the best-determined layer, the thin surface the worst', () => {
  // A 2 in surface over a thick base: Huang §9.4.3 warns the basin is
  // insensitive to thin layers, so the fit should say so through its
  // sensitivity numbers rather than silently returning a confident answer.
  const truth = [
    { h: 2, E: 350000, nu: 0.35 },
    { h: 10, E: 25000, nu: 0.35 },
    { h: 0, E: 9000, nu: 0.40 },
  ];
  const measured = basin(truth, 80, 5.9, OFFSETS);
  const fit = backcalculate(
    truth.map(l => ({ ...l, E: l.E * 0.5 })), 80, 5.9, OFFSETS, measured, { tolPct: 0.05 }
  );
  assert.ok(fit.rmsPct < 1, 'basin matched');
  // Sensitivity is "extra RMS % from being 20% wrong" — biggest for the
  // subgrade, smallest for the thin surface.
  assert.ok(fit.sensitivity[2] > fit.sensitivity[0],
    `subgrade (${fit.sensitivity[2].toFixed(2)}) should out-rank the 2in surface (${fit.sensitivity[0].toFixed(2)})`);
});

test('a fixed layer is not moved by the fit', () => {
  const truth = [
    { h: 4, E: 400000, nu: 0.35 },
    { h: 8, E: 30000, nu: 0.35 },
    { h: 0, E: 12000, nu: 0.40 },
  ];
  const measured = basin(truth, 80, 5.9, OFFSETS);
  const seed = [
    { h: 4, E: 500000, nu: 0.35 },
    { h: 8, E: 20000, nu: 0.35 },
    { h: 0, E: 8000, nu: 0.40 },
  ];
  const fit = backcalculate(seed, 80, 5.9, OFFSETS, measured, { fixed: [0] });
  assert.equal(fit.E[0], 500000, 'the fixed AC modulus is untouched');
  assert.ok(fit.E[2] > 8000, 'the free layers still moved');
});

/* ────────────────────────────── Basin indices ───────────────────────────── */

test('basin indices come out of the right sensor pairs', () => {
  const offsets = [0, 12, 24, 36];
  const defl = [0.020, 0.014, 0.009, 0.006];
  const ix = basinIndices(offsets, defl);
  near(ix.sci, 0.006, 1e-9, 'SCI');
  near(ix.bdi, 0.005, 1e-9, 'BDI');
  near(ix.bci, 0.003, 1e-9, 'BCI');
  near(ix.area, 6 * (1 + 2 * 0.7 + 2 * 0.45 + 0.3), 1e-9, 'area');
});

test('a perfectly rigid basin has the theoretical maximum area of 36 in', () => {
  const ix = basinIndices([0, 12, 24, 36], [0.01, 0.01, 0.01, 0.01]);
  near(ix.area, 36, 1e-9, 'area of a flat basin');
});

/* ─────────────────────────── Temperature factor ─────────────────────────── */

test('the temperature factor is 1.0 at the 68°F standard and softens above it', () => {
  near(temperatureFactor(68, 4.25), 1, 1e-12, 'factor at 68°F');
  assert.ok(temperatureFactor(80, 4.25) < 1, 'hot pavement deflects more, so d0 is scaled down');
  assert.ok(temperatureFactor(50, 4.25) > 1, 'cold pavement deflects less, so d0 is scaled up');
  assert.ok(temperatureFactor(100, 10) < temperatureFactor(100, 2),
    'a thicker AC layer carries more of the basin, so temperature matters more');
});

/* ───────────────────────────── Determinacy ─────────────────────────────── */

test('a fit with as many unknowns as sensors is flagged as undetermined', () => {
  assert.equal(isDetermined(7, 3), true, '7 sensors, 3 free moduli');
  assert.equal(isDetermined(3, 3), false, 'square systems fit anything');
  assert.equal(isDetermined(2, 3), false, 'Huang Example 13.11 has only two sensors');
});

/* ─────────────────────── Preset data is real data ──────────────────────── */
// The tool ships three presets. Two of them quote a basin as though it were
// measured; these tests assert those numbers are the actual forward solution
// of the moduli the preset claims, so a preset can never drift into being
// plausible-looking invented data.

const PLATE = { P: 9000, a: 5.9 };
const Q = PLATE.P / (Math.PI * PLATE.a ** 2);

test('the synthetic preset basin is the forward solution of 420/28/11 ksi', () => {
  const truth = [
    { h: 4, E: 420000, nu: 0.35 },
    { h: 8, E: 28000, nu: 0.35 },
    { h: 0, E: 11000, nu: 0.40 },
  ];
  const w = basin(truth, Q, PLATE.a, OFFSETS).map(x => +(x / 0.001).toFixed(2));
  assert.deepEqual(w, [25.44, 19.83, 16.33, 12.38, 9.67, 6.43, 3.69]);
});

const THIN = [
  { h: 2, E: 200000, nu: 0.35 },
  { h: 10, E: 18000, nu: 0.35 },
  { h: 0, E: 8000, nu: 0.40 },
];
/** The seed the thin-surface preset ships — deliberately far from the truth. */
const THIN_SEED = [
  { h: 2, E: 450000, nu: 0.35 },
  { h: 10, E: 30000, nu: 0.35 },
  { h: 0, E: 13000, nu: 0.40 },
];
const FIT_BOUNDS = { lo: [3000, 3000, 1500], hi: [3e6, 3e5, 3e5], tolPct: 0.1 };

test('the thin-surface preset basin is 200/18/8 ksi under 1.5% noise', () => {
  // Not the clean forward solution: the preset deliberately carries instrument
  // noise, so the test pins it to the noisy values the tool actually ships and
  // checks they sit within measurement error of the true basin.
  const shipped = [51.76, 30.92, 23.46, 16.45, 13.10, 8.91, 5.05];
  const clean = basin(THIN, Q, PLATE.a, OFFSETS).map(x => x / 0.001);
  shipped.forEach((v, i) => {
    const dev = Math.abs(v / clean[i] - 1);
    assert.ok(dev < 0.05,
      `sensor ${OFFSETS[i]}: shipped ${v} is ${(100 * dev).toFixed(1)}% off the true basin`);
  });
});

test('without noise even a weakly-determined layer is recoverable', () => {
  // The honest baseline, and the reason the preset carries noise at all.
  const clean = basin(THIN, Q, PLATE.a, OFFSETS);
  const fit = backcalculate(THIN_SEED, Q, PLATE.a, OFFSETS, clean, FIT_BOUNDS);
  near(fit.E[0], 200000, 0.10, 'surface modulus from a noise-free basin');
});

test('1.5% measurement noise destroys the surface modulus and spares the subgrade', () => {
  // This is Huang §9.4.3 made quantitative, and the whole point of the preset:
  // a good basin match with a badly wrong modulus for the thin layer.
  const shipped = [51.76, 30.92, 23.46, 16.45, 13.10, 8.91, 5.05].map(m => m * 0.001);
  const fit = backcalculate(THIN_SEED, Q, PLATE.a, OFFSETS, shipped, FIT_BOUNDS);

  assert.ok(fit.rmsPct < 3,
    `the basin still matches well (${fit.rmsPct.toFixed(2)}% RMS) — that is what makes it dangerous`);
  near(fit.E[2], 8000, 0.05, 'subgrade survives the noise');

  const surfErr = Math.abs(fit.E[0] / 200000 - 1);
  assert.ok(surfErr > 0.25,
    `the surface modulus should be badly wrong; it came back ${(100 * surfErr).toFixed(0)}% off`);
});

test('the sensitivity ranking flags the surface as the blind layer', () => {
  const shipped = [51.76, 30.92, 23.46, 16.45, 13.10, 8.91, 5.05].map(m => m * 0.001);
  const fit = backcalculate(THIN_SEED, Q, PLATE.a, OFFSETS, shipped, FIT_BOUNDS);
  const ratio = fit.sensitivity[0] / fit.sensitivity[2];
  // The tool warns below a ratio of 0.05.
  assert.ok(ratio < 0.05,
    `surface is ${(1 / ratio).toFixed(0)}x less determined than the subgrade — should trip the warning`);
});

test('Example 13.11 needs the chart factor, not the built-in suggestion', () => {
  // The whole point of the manual override: the built-in interpolation gives
  // 0.82 where Huang reads 0.92 off Figure 13.18, and SN_eff moves by 9%.
  const suggested = temperatureFactor(80, 4.25);
  near(suggested, 0.82, 0.02, 'built-in suggestion');

  const withChart = aashtoNdt(9000, 5.9, 0.92 * 0.0139, 0.00355, 36, 12.25, 0.33);
  near(withChart.snEff, 2.88, 0.02, 'SN_eff with the chart factor');

  const withGuess = aashtoNdt(9000, 5.9, suggested * 0.0139, 0.00355, 36, 12.25, 0.33);
  assert.ok(withGuess.snEff > withChart.snEff * 1.05,
    `the approximation overstates SN_eff (${withGuess.snEff.toFixed(2)} vs ${withChart.snEff.toFixed(2)})`);

  // M_R comes from the outer sensor and is untouched by the correction.
  near(withGuess.mrBackcalculated, withChart.mrBackcalculated, 1e-12, 'M_R is unaffected');
});
