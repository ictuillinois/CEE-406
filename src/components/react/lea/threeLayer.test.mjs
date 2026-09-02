// Acceptance tests for the three-layer module, against Jones' Table 2.3 and
// Huang's Examples 2.11 and 2.12. Run:
//   node --experimental-strip-types --test src/components/react/lea/threeLayer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stressFactors, threeLayerState, radialStrainBottomLayer1, groupsFor,
} from './threeLayer.ts';
import { leaResponse } from './lea.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.abs(e) * tol,
    `${what}: got ${a}, expected ~${e} (±${(tol * 100).toFixed(2)}%)`);

test("Example 2.11: the four factors match Jones' printed table", () => {
  // k1 = 20, k2 = 2, A = 0.8, H = 1.0 — an exact row of Table 2.3, so no
  // interpolation is involved and the comparison is clean.
  //
  //   ZZ1 = 0.12173   ZZ2 = 0.05938   ZZ1-RR1 = 1.97428   ZZ2-RR2 = 0.09268
  //
  // These are the tightest anchors in the whole tool: Jones computed them
  // from the same elastic theory, on a machine in 1962, to five decimals.
  const f = stressFactors({ k1: 20, k2: 2, A: 0.8, H: 1.0 });
  near(f.ZZ1, 0.12173, 1e-3, 'ZZ1');
  near(f.ZZ2, 0.05938, 1e-3, 'ZZ2');
  near(f.ZZ1_RR1, 1.97428, 1e-3, 'ZZ1 - RR1');
  near(f.ZZ2_RR2, 0.09268, 1e-3, 'ZZ2 - RR2');
});

test('Example 2.11: every stress and strain the example prints', () => {
  // a = 4.8 in, q = 120 psi, h1 = h2 = 6 in, E = 400,000 / 20,000 / 10,000.
  const p = groupsFor(400000, 20000, 10000, 6, 6, 4.8);
  near(p.k1, 20, 1e-12, 'k1');
  near(p.k2, 2, 1e-12, 'k2');
  near(p.A, 0.8, 1e-12, 'A');
  near(p.H, 1, 1e-12, 'H');

  const s = threeLayerState(p, 120, 400000);

  // Eq. 2.24.
  near(s.bot1.sigZ, 14.61, 0.01, 'sigma_z1');
  near(s.bot2.sigZ, 7.12, 0.01, 'sigma_z2');

  // Bottom of layer 1: sigma_r = 14.61 - 236.91 = -222.3 psi (tension).
  near(s.bot1.sigR, -222.3, 0.01, 'sigma_r at the bottom of layer 1');
  near(s.bot1.epsZ, 5.92e-4, 0.01, 'eps_z at the bottom of layer 1');
  near(s.bot1.epsR, -2.96e-4, 0.01, 'eps_r at the bottom of layer 1');

  // Top of layer 2, via Eq. 2.23: the deviator drops by k1 = 20.
  near(s.top2.sigZ - s.top2.sigR, 11.85, 0.01, 'deviator at the top of layer 2');
  near(s.top2.sigR, 2.76, 0.02, 'sigma_r at the top of layer 2');
  near(s.top2.epsZ, 5.92e-4, 0.01, 'eps_z at the top of layer 2');

  // Bottom of layer 2 and top of layer 3.
  near(s.bot2.sigR, -4.0, 0.02, 'sigma_r at the bottom of layer 2');
  near(s.bot2.epsZ, 5.56e-4, 0.01, 'eps_z at the bottom of layer 2');
  near(s.top3.sigR, 1.56, 0.03, 'sigma_r at the top of layer 3');
  near(s.top3.epsZ, 5.56e-4, 0.01, 'eps_z at the top of layer 3');

  // Eq. 2.21: at nu = 0.5 the vertical strain is twice the radial one, and
  // opposite in sign. This is what makes Figure 2.21 double as a subgrade
  // strain chart.
  for (const k of ['bot1', 'top2', 'bot2', 'top3']) {
    near(s[k].epsZ, -2 * s[k].epsR, 1e-9, `eps_z = -2 eps_r at ${k}`);
  }

  // The radial strain must be continuous across each interface — that is the
  // physical statement Eq. 2.23 encodes.
  near(s.bot1.epsR, s.top2.epsR, 1e-9, 'eps_r continuous at interface 1');
  near(s.bot2.epsR, s.top3.epsR, 1e-9, 'eps_r continuous at interface 2');
});

test('Example 2.12: Peattie chart factor, and the thickness that barely matters', () => {
  // "Given k1 = 20, k2 = 2, A = 0.8, and H = 1.0, from Figure 2.31c,
  // (RR1 - ZZ1)/2 = 1. From Eq. 2.25, eps_r = 120/400,000 = 3 x 10^-4
  // (tension), which checks closely with the 2.96 x 10^-4 from the table.
  // Given h2 = 8 in., A = 4.8/8 = 0.6, and H = 6/8 = 0.75, from Figure 2.31c,
  // the strain factor is still close to 1, indicating that the thickness of
  // layer 2 has very little effect... The radial strain obtained from
  // KENLAYER is 2.91 x 10^-4."
  const a = stressFactors({ k1: 20, k2: 2, A: 0.8, H: 1.0 });
  near(a.peattie, 0.987, 0.01, 'Peattie factor at A = 0.8, H = 1.0');
  const er = radialStrainBottomLayer1({ k1: 20, k2: 2, A: 0.8, H: 1.0 }, 120, 400000);
  assert.ok(er < 0, 'the strain at the bottom of layer 1 must be tension');
  near(Math.abs(er), 2.96e-4, 0.02, 'eps_r against the table value');
  // The chart read of "1" gives 3.0e-4; KENLAYER gives 2.91e-4; the table
  // gives 2.96e-4. Computing the factor lands on the table, as it should.

  const b = stressFactors({ k1: 20, k2: 2, A: 0.6, H: 0.75 });
  assert.ok(Math.abs(b.peattie - 1) < 0.12,
    `thickening layer 2 should barely move the factor (got ${b.peattie})`);
});

test('the factors agree with a direct solve of the same section', () => {
  // stressFactors normalizes to h2 = 1, E3 = 1. A section with the same
  // ratios but different absolute sizes must give the same factors — that is
  // the claim the whole parametrization rests on.
  const p = { k1: 20, k2: 2, A: 0.8, H: 1.0 };
  const f = stressFactors(p);
  const layers = [
    { h: 6, E: 400000, nu: 0.5 },
    { h: 6, E: 20000, nu: 0.5 },
    { h: 0, E: 10000, nu: 0.5 },
  ];
  const R1 = leaResponse(layers, 120, 4.8, 0, 6 * (1 - 1e-9));
  near(f.ZZ1, R1.sigZ / 120, 1e-6, 'ZZ1 is scale-free');
  near(f.ZZ1_RR1, (R1.sigZ - R1.sigR) / 120, 1e-6, 'ZZ1 - RR1 is scale-free');
});

test('Problem 2.6: the three-layer section HW4 uses', () => {
  // 5.75 in HMA at 400,000 psi over 23 in base at 20,000 psi over a 10,000 psi
  // subgrade, 40,000 lb at 150 psi. Printed answers: horizontal tensile strain
  // at the bottom of the HMA -7.25e-4, vertical compressive strain on top of
  // the subgrade 1.06e-3.
  const a = Math.sqrt(40000 / (Math.PI * 150));
  const p = groupsFor(400000, 20000, 10000, 5.75, 23, a);
  const s = threeLayerState(p, 150, 400000);
  near(s.bot1.epsR, -7.25e-4, 0.06, 'tensile strain at the bottom of the HMA');
  near(s.top3.epsZ, 1.06e-3, 0.06, 'compressive strain on the subgrade');
});

test('the Peattie factor behaves the way its charts are drawn', () => {
  // A wider load bends layer 1 more; a thicker layer 1 bends less. Both hold,
  // but only over part of the grid — Figure 2.31 is a lattice of two crossing
  // families precisely because neither direction is monotone everywhere.
  for (const H of [1, 2, 4, 8]) {
    let prev = -Infinity;
    for (const A of [0.1, 0.2, 0.4, 0.8, 1.6, 3.2]) {
      const v = stressFactors({ k1: 20, k2: 2, A, H }).peattie;
      assert.ok(v > prev, `factor should rise with A at H = ${H} (A = ${A})`);
      prev = v;
    }
  }
  // The H direction is monotone only for the narrower loads: by A = 0.8 the
  // factor already rises from H = 0.125 to H = 0.25 before turning over,
  // because a layer 1 that thin under a load that wide is not bending at all.
  for (const A of [0.1, 0.2, 0.4]) {
    let prev = Infinity;
    for (const H of [0.125, 0.25, 0.5, 1, 2, 4, 8]) {
      const v = stressFactors({ k1: 20, k2: 2, A, H }).peattie;
      assert.ok(v < prev, `factor should fall with H at A = ${A} (H = ${H})`);
      prev = v;
    }
  }
});

test('the corner where the chart cannot follow: layer 1 stops bending', () => {
  // At H = 0.125 and A = 3.2 — a layer 1 an eighth the thickness of layer 2,
  // under a load 3.2 times as wide as layer 2 is thick — the factor goes
  // NEGATIVE. The bottom of layer 1 is in compression: the load is so broad
  // relative to the structure that the response is nearly confined
  // compression and there is no bending to put the underside in tension.
  //
  // Figure 2.31 has a logarithmic ordinate and simply cannot draw that, which
  // is why its lattice closes to a point at the bottom rather than continuing.
  // A tool with a linear readout can, so it must not pretend the sign is
  // always the same.
  const v = stressFactors({ k1: 20, k2: 2, A: 3.2, H: 0.125 }).peattie;
  assert.ok(v < 0, `expected compression at the bottom of a paper-thin layer 1, got ${v}`);
  const er = radialStrainBottomLayer1({ k1: 20, k2: 2, A: 3.2, H: 0.125 }, 120, 400000);
  assert.ok(er > 0, 'and the radial strain there is compressive, not tensile');
});

test('each panel of Figure 2.31 peaks where the printed lattice peaks', () => {
  // The top vertex of each lattice is the one place a five-decade log chart
  // can be read with any confidence, and it is where the four panels differ
  // from each other. Reading them off Huang's reprint:
  //
  //   (a) k1=2,  k2=2   lattice tops just under 1
  //   (b) k1=2,  k2=20  tops at about 1
  //   (c) k1=20, k2=2   tops between 3 and 4
  //   (d) k1=20, k2=20  tops between 8 and 10
  //
  // The computed maxima are 0.59, 1.08, 3.49 and 8.19.
  const A_VALUES = [0.1, 0.2, 0.4, 0.8, 1.6, 3.2];
  const H_VALUES = [0.125, 0.25, 0.5, 1, 2, 4, 8];
  const peak = (k1, k2) => {
    let hi = -Infinity;
    for (const A of A_VALUES) for (const H of H_VALUES) {
      hi = Math.max(hi, stressFactors({ k1, k2, A, H }).peattie);
    }
    return hi;
  };
  const within = (v, lo, hi, what) =>
    assert.ok(v > lo && v < hi, `${what}: ${v} is outside the panel's printed range ${lo}-${hi}`);
  within(peak(2, 2), 0.3, 1.0, 'panel (a) k1 = 2, k2 = 2');
  within(peak(2, 20), 0.7, 1.6, 'panel (b) k1 = 2, k2 = 20');
  within(peak(20, 2), 3.0, 4.0, 'panel (c) k1 = 20, k2 = 2');
  within(peak(20, 20), 7.0, 10.0, 'panel (d) k1 = 20, k2 = 20');

  // The panels Huang reprints for k1 = 200 are steeper still, and must stay
  // under the charts' ceiling of 100.
  assert.ok(peak(200, 2) < 100 && peak(200, 20) < 100,
    'the k1 = 200 panels must still fit under the printed ceiling');
});

test('the lattice corner Peattie clipped', () => {
  // At A = 0.1 with H = 8 — the narrowest load on the thickest layer 1 — the
  // lattice closes to a point sitting ON the bottom axis, and for the softer
  // panels the true value is BELOW it: 2.0e-4 at k1 = k2 = 2, against the
  // 1e-3 the printed axis stops at. The figure shows that vertex touching the
  // frame with its labels outside it, so the chart is clipped there rather
  // than disagreeing.
  //
  // A tool with a linear readout has no axis to clip against, so it must not
  // inherit the chart's floor. Recorded, not tuned away.
  const soft = stressFactors({ k1: 2, k2: 2, A: 0.1, H: 8 }).peattie;
  assert.ok(soft > 0 && soft < 1e-3,
    `expected the clipped corner below the axis floor, got ${soft}`);
  const stiff = stressFactors({ k1: 200, k2: 2, A: 0.1, H: 8 }).peattie;
  assert.ok(stiff > 1e-4 && stiff < 1e-2, `stiff panel corner: ${stiff}`);
});
