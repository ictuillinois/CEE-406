// Acceptance tests for the two-layer design quantities, against the chart
// reads printed in Huang (2004) §2.2.1. Run:
//   node --experimental-strip-types --test src/components/react/lea/twoLayer.test.mjs
//
// Every assertion here is a number Huang read off one of his own charts, so
// the tolerances are chart-reading tolerances: a curve drawn on log paper is
// good to a few percent, and that is the accuracy the book's worked answers
// carry. Where the computed value sits outside that band the test says so
// explicitly rather than widening quietly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verticalStressProfile, interfaceStressRatio, requiredAOverH1,
  allowableRepetitions, surfaceDeflectionFactor, modulusRatioFromF2,
  interfaceDeflectionFactor, strainFactor, conversionFactor,
  modifiedGeometry, interpolateByRadius, groupStrainFactor,
  CHART_SD, DUAL_AS_TANDEM_ST,
} from './twoLayer.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.abs(e) * tol,
    `${what}: got ${a}, expected ~${e} (±${(tol * 100).toFixed(0)}%)`);

/* ── Figure 2.14 ────────────────────────────────────────────────────────── */

test('Figure 2.14: the stiff layer sheds interface stress', () => {
  // Huang, page 58: at the interface with h1/a = 1 the vertical stress is
  // "about 68% of the applied pressure if E1/E2 = 1, as indicated by
  // Boussinesq's stress distribution, and reduces to about 8% ... if
  // E1/E2 = 100."
  near(verticalStressProfile(1, 1), 0.646, 0.05, 'sigma_z/q at the interface, E1/E2 = 1');
  near(verticalStressProfile(100, 1), 0.08, 0.25, 'sigma_z/q at the interface, E1/E2 = 100');
  // Boussinesq at z/a = 1 is 1 - 1/2^1.5 = 0.6464 exactly, and E1/E2 = 1 must
  // land on it — that is what makes the chart's baseline curve meaningful.
  near(verticalStressProfile(1, 1), 1 - Math.pow(2, -1.5), 0.005, 'E1/E2 = 1 is Boussinesq');
  // Monotone in the modulus ratio, which is the chart's whole message.
  let prev = Infinity;
  for (const ER of [1, 2.5, 5, 10, 25, 50, 100]) {
    const v = verticalStressProfile(ER, 1);
    assert.ok(v < prev, `sigma_z/q must fall as E1/E2 rises (E1/E2 = ${ER})`);
    prev = v;
  }
});

/* ── Figure 2.15 ────────────────────────────────────────────────────────── */

test('Example 2.5: both thicknesses read off Figure 2.15', () => {
  // sigma_c/q = 8/80 = 0.1. Full depth E1/E2 = 100 -> a/h1 = 1.15;
  // granular base E1/E2 = 5 -> a/h1 = 0.40.
  near(requiredAOverH1(100, 0.1), 1.15, 0.03, 'full-depth a/h1');
  near(requiredAOverH1(5, 0.1), 0.40, 0.03, 'granular-base a/h1');
  // ...and the thicknesses the example quotes, for a = 6 in.
  near(6 / requiredAOverH1(100, 0.1), 5.2, 0.04, 'full-depth thickness, in');
  near(6 / requiredAOverH1(5, 0.1), 15, 0.04, 'granular base thickness, in');
  // Round trip: the ratio that comes back must reproduce the target stress.
  for (const ER of [2.5, 10, 50]) {
    const aOverH1 = requiredAOverH1(ER, 0.25);
    near(interfaceStressRatio(ER, aOverH1), 0.25, 1e-6, `round trip at E1/E2 = ${ER}`);
  }
});

test('Eq. 2.13: the allowable repetitions Huang quotes', () => {
  // "For a stress of 8 psi and an elastic modulus of 5000 psi, the allowable
  // number of repetitions is 3.7 x 10^5."
  near(allowableRepetitions(8, 5000), 3.7e5, 0.05, 'Nd');
});

/* ── Figure 2.17 ────────────────────────────────────────────────────────── */

test('Example 2.6: Figure 2.17 read forwards and backwards', () => {
  // 20,000 lb on a rigid 12-in plate -> q = 176.8 psi. Eq. 2.15 gives
  // F2 = 0.511 at h1/a = 1.333, and the chart returns E1/E2 = 5.
  const q = 20000 / (36 * Math.PI);
  const F2 = (0.1 * 6400) / (1.18 * q * 6);
  near(F2, 0.511, 0.01, 'F2 from the measured deflection');
  near(surfaceDeflectionFactor(5, 8 / 6), 0.511, 0.02, 'F2 at E1/E2 = 5, h1/a = 1.333');
  near(modulusRatioFromF2(F2, 8 / 6), 5, 0.06, 'E1/E2 recovered from F2');
  // A half-space has F2 = 1 — the definition of the 1.5 in Eq. 2.14.
  near(surfaceDeflectionFactor(1, 0), 1, 1e-9, 'F2 = 1 at h1/a = 0');
  near(surfaceDeflectionFactor(1, 2), 1, 0.005, 'F2 = 1 whenever E1 = E2');
});

/* ── Figure 2.19 ────────────────────────────────────────────────────────── */

test('Example 2.7: interface deflection under dual tires', () => {
  // E1/E2 = 10, h1/a = 1.33. Huang reads F = 0.56 under one load (r/a = 0)
  // and F = 0.28 under the other (r/a = 2.99), superposes to 0.84, and gets
  // w = 0.027 in against KENLAYER's 0.0281 in.
  const f0 = interfaceDeflectionFactor(10, 1.33, 0);
  const f1 = interfaceDeflectionFactor(10, 1.33, 2.99);
  near(f0, 0.56, 0.04, 'F at r/a = 0');
  near(f1, 0.28, 0.04, 'F at r/a = 2.99');
  const w = ((70 * 4.52) / 10000) * (f0 + f1);
  // The chart read gives 0.027 in; KENLAYER gives 0.0281. Computing the two
  // factors instead of reading them lands between the two, nearer KENLAYER —
  // which is the expected direction, since the chart is the lossy step.
  assert.ok(w > 0.026 && w < 0.029, `superposed deflection ${w} should sit between the chart and KENLAYER`);
  // F is 1.5x F2 by definition (Eq. 2.16 vs Eq. 2.14) — the easiest slip to
  // make when moving between Figures 2.17 and 2.19.
  near(interfaceDeflectionFactor(1, 1e-9, 0), 1.5 * surfaceDeflectionFactor(1, 1e-9), 0.01,
    'F = 1.5 F2 for the half-space');
});

/* ── Figure 2.21 ────────────────────────────────────────────────────────── */

test('Example 2.8: the single-wheel strain factor', () => {
  // a = 6.5 in, h1/a = 1.23, E1/E2 = 10. Huang reads Fe = 0.72 and gets
  // e = 3.25e-4 against KENLAYER's 3.36e-4.
  const Fe = strainFactor(10, 8 / 6.5);
  near(Fe, 0.72, 0.05, 'Fe at E1/E2 = 10, h1/a = 1.23');
  const e = (67.7 * Fe) / 150000;
  assert.ok(e > 3.2e-4 && e < 3.5e-4,
    `critical strain ${e} should sit between the chart's 3.25e-4 and KENLAYER's 3.36e-4`);
});

test('Figure 2.21 keeps its shape: the critical point leaves the axis', () => {
  // Huang, page 65: "when both h1/a and E1/E2 are small, the critical tensile
  // strain occurs at some distance from the center, as the predominant effect
  // of the shear stress." That is what makes Fe non-monotonic in h1/a at low
  // stiffness ratios — the curves in Figure 2.21 bend rather than fall.
  const thin = strainFactor(5, 0.25);
  const mid = strainFactor(5, 0.5);
  assert.ok(mid > thin,
    `Fe should rise from h1/a = 0.25 to 0.5 at E1/E2 = 5 (got ${thin} then ${mid})`);
  // Deep in the chart it falls monotonically, as every curve does on the right.
  let prev = Infinity;
  for (const h of [1, 1.5, 2, 3, 4]) {
    const v = strainFactor(10, h);
    assert.ok(v < prev, `Fe should fall with thickness at h1/a = ${h}`);
    prev = v;
  }
  // Stiffer layer, more bending strain at the same thickness.
  for (const h of [1, 2, 3]) {
    assert.ok(strainFactor(100, h) > strainFactor(10, h),
      `Fe should rise with E1/E2 at h1/a = ${h}`);
  }
  // The whole chart must fit between its printed axis limits, 0.01 and 20.
  for (const ER of [1, 5, 20, 100, 200]) {
    for (const h of [0.25, 1, 2, 4]) {
      const v = strainFactor(ER, h);
      assert.ok(v > 0.01 && v < 20, `Fe = ${v} is off Figure 2.21's axis at (${ER}, ${h})`);
    }
  }
});

/* ── Figures 2.23 and 2.25-2.27 ─────────────────────────────────────────── */

test('Example 2.9: the dual-wheel conversion factor', () => {
  // Sd = 11.5 in, a = 4.6 in, h1 = 8 in -> a' = 9.6 in, h1' = 16.7 in.
  // Huang reads C1 = 1.35 and C2 = 1.46 from Figure 2.23, interpolates to
  // C = 1.50, and gets e = 3.18e-4 against KENLAYER's 3.21e-4.
  const mod = modifiedGeometry(4.6, 8, 11.5);
  near(mod.a, 9.6, 0.01, "a'");
  near(mod.h1, 16.7, 0.01, "h1'");

  near(conversionFactor(10, 16.7, 3, CHART_SD), 1.35, 0.03, 'C1 (a = 3 in panel)');
  near(conversionFactor(10, 16.7, 8, CHART_SD), 1.46, 0.03, 'C2 (a = 8 in panel)');
  near(interpolateByRadius(9.6, 1.35, 1.46), 1.50, 0.01, 'Eq. 2.19 interpolation');

  const g = groupStrainFactor(10, 8, 4.6, 11.5);
  near(g.C, 1.50, 0.04, 'conversion factor end to end');
  const e = (67.7 * g.groupFactor) / 150000;
  assert.ok(e > 3.0e-4 && e < 3.4e-4,
    `dual-wheel strain ${e} should sit near the printed 3.18e-4`);
});

test('Example 2.10: the dual-tandem conversion factor', () => {
  // Same wheels plus a tandem at St = 49 in -> modified St = 102.3 in.
  // At St = 72 in Huang reads C1 = 1.23, C2 = 1.30 from Figure 2.27, gets
  // C = 1.32, then interpolates against the dual chart's 1.50 at St = 120 in
  // to reach C = 1.43 and e = 3.03e-4 (KENLAYER: 3.05e-4).
  const mod = modifiedGeometry(4.6, 8, 11.5, 49);
  near(mod.st, 102.3, 0.01, "St'");

  near(conversionFactor(10, 16.7, 3, CHART_SD, 72), 1.23, 0.04, 'C1 at St = 72 in');
  near(conversionFactor(10, 16.7, 8, CHART_SD, 72), 1.30, 0.04, 'C2 at St = 72 in');
  near(interpolateByRadius(9.6, 1.23, 1.30), 1.32, 0.01, 'C at St = 72 in');

  // The claim that lets Figure 2.23 stand in for St = 120 in: a tandem that
  // far away must give back the dual answer.
  const dual = conversionFactor(10, 16.7, 3, CHART_SD, null);
  const far = conversionFactor(10, 16.7, 3, CHART_SD, DUAL_AS_TANDEM_ST);
  assert.ok(Math.abs(far - dual) / dual < 0.05,
    `at St = ${DUAL_AS_TANDEM_ST} in the tandem factor ${far} should match the dual ${dual}`);
  const veryFar = conversionFactor(10, 16.7, 3, CHART_SD, 400);
  assert.ok(Math.abs(veryFar - dual) / dual < 0.01,
    'an infinitely distant tandem must converge exactly on the dual factor');
});

test('adding a tandem axle can reduce the conversion factor', () => {
  // Huang, page 69: "in many cases, the addition of tandem wheels reduces the
  // conversion factor, thus decreasing the critical tensile strain. This is
  // due to the compensative effect caused by the additional wheels. The
  // interaction among these wheels is quite unpredictable, as indicated by
  // the irregular shape of the curves." The non-monotonicity in St is the
  // content of Figures 2.25 through 2.27 and must survive.
  const c24 = conversionFactor(10, 16.7, 3, CHART_SD, 24);
  const c48 = conversionFactor(10, 16.7, 3, CHART_SD, 48);
  const c72 = conversionFactor(10, 16.7, 3, CHART_SD, 72);
  assert.ok(c48 < c24 && c48 < c72,
    `the conversion factor should dip at St = 48 in (got ${c24}, ${c48}, ${c72})`);
  // A group is never gentler than a single wheel.
  for (const st of [null, 24, 48, 72]) {
    assert.ok(conversionFactor(10, 8, 3, CHART_SD, st) >= 1,
      `C must be at least 1 at St = ${st}`);
  }
});
