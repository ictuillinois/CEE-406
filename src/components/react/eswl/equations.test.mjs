// Tests for the equivalent single-wheel load criteria. Run with:
//   node --experimental-strip-types --test src/components/react/eswl/equations.test.mjs
//
// Anchored to Huang (2004) Examples 6.1, 6.2, 6.3 and 6.5, which all use the
// same dual configuration and get four different answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dualClearance, eswlBoydFoster, eswlEqualStress, eswlEqualDeflection,
  eswlEqualStrain, modifiedGeometry, compareEswl, boydFosterAnchors,
  candidatePoints,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* Examples 6.1-6.3 and 6.5 all use: 2Pd = 9000 lb, a = 4.5 in, Sd = 13.5 in. */
const EX = { Pd: 4500, a: 4.5, Sd: 13.5, z: 13.5 };

/* ─────────────── Example 6.1 — Boyd and Foster, empirical ──────────────── */

test('the dual clearance is the spacing less two radii', () => {
  near(dualClearance(13.5, 4.5), 4.5, 1e-12, 'clearance d');   // book: 4.5 in
});

test('Example 6.1 — Boyd and Foster ESWL for a 13.5 in pavement', () => {
  near(eswlBoydFoster(EX.Pd, 13.5, EX.Sd, EX.a), 7410, 0.01, 'ESWL');  // book: 7410 lb
});

test('Example 6.1 — the two anchors need no interpolation', () => {
  const { noOverlap, fullOverlap } = boydFosterAnchors(EX.Sd, EX.a);
  near(noOverlap, 2.25, 1e-12, 'z at which stress bulbs have not met');   // book: 2.25 in
  near(fullOverlap, 27, 1e-12, 'z at which they have merged');            // book: 27 in
  // At those depths the answer is exactly Pd and 2Pd.
  near(eswlBoydFoster(EX.Pd, noOverlap, EX.Sd, EX.a), 4500, 1e-9, 'ESWL at d/2');
  near(eswlBoydFoster(EX.Pd, fullOverlap, EX.Sd, EX.a), 9000, 1e-9, 'ESWL at 2Sd');
});

test('Boyd and Foster is monotonic between its anchors', () => {
  let prev = 0;
  for (let z = 2.25; z <= 27; z += 1) {
    const e = eswlBoydFoster(EX.Pd, z, EX.Sd, EX.a);
    assert.ok(e >= prev - 1e-9, `ESWL should not fall with depth at z = ${z}`);
    assert.ok(e >= 4500 - 1e-6 && e <= 9000 + 1e-6, `ESWL ${e} outside Pd..2Pd`);
    prev = e;
  }
});

/* ────────────── Example 6.2 — Boussinesq, equal vertical stress ────────── */

test('Example 6.2 — the equal-stress ESWL', () => {
  const r = eswlEqualStress(EX.Pd, EX.z, EX.Sd, EX.a);
  // Book reads the factors off Figure 2.2 and gets 0.179/0.143 x 4500 = 5630 lb.
  // Integrating the kernel instead lands within chart-reading precision.
  near(r.eswl, 5630, 0.03, 'ESWL');
  assert.ok(r.dualFactor > r.singleFactor, 'the duals do more than one tire');
});

test('Example 6.2 — the three candidate points are nearly equal in stress', () => {
  const r = eswlEqualStress(EX.Pd, EX.z, EX.Sd, EX.a);
  // Book: 0.173, 0.179, 0.176 — "nearly the same", governed by point 2.
  assert.equal(r.factors.length, 3);
  const spread = (Math.max(...r.factors) - Math.min(...r.factors)) / Math.max(...r.factors);
  assert.ok(spread < 0.08, `stress varies only ${(100 * spread).toFixed(1)}% across the three points`);
  assert.equal(r.governingPoint, 1, 'the midway point governs, as in the book');
});

test('candidate points are under a tire, midway, and between those', () => {
  assert.deepEqual(candidatePoints(13.5), [0, 3.375, 6.75]);
});

/* ──────────── Example 6.3 — Foster and Ahlvin, equal deflection ────────── */

test('Example 6.3 — the equal-deflection ESWL', () => {
  const r = eswlEqualDeflection(EX.Pd, EX.z, EX.Sd, EX.a, 0.5);
  // Book: 0.78/0.478 x 4500 = 7340 lb from Figure 2.6.
  near(r.eswl, 7340, 0.03, 'ESWL');
});

test('Example 6.3 — deflection is governed by the point BETWEEN the tires', () => {
  const r = eswlEqualDeflection(EX.Pd, EX.z, EX.Sd, EX.a, 0.5);
  // Unlike stress, which peaked at the midway point, deflection peaks at the
  // center of the pair — deflection spreads further, so the two bowls add up
  // most where they meet.
  assert.equal(r.governingPoint, 2, 'the center between the tires governs');
});

test('deflection interacts more than stress, so its ESWL is larger', () => {
  const s = eswlEqualStress(EX.Pd, EX.z, EX.Sd, EX.a);
  const d = eswlEqualDeflection(EX.Pd, EX.z, EX.Sd, EX.a, 0.5);
  assert.ok(d.eswl > s.eswl,
    `deflection ${d.eswl.toFixed(0)} should exceed stress ${s.eswl.toFixed(0)}`);
});

/* ───────────── Example 6.5 — equal tensile strain (layered) ────────────── */

test('Example 6.5 — the modified geometry for the conversion charts', () => {
  // Sd = 13.5, a = 4.5, h1 = 8 → a' = 24/13.5 x 4.5 = 8 in, h1' = 14.2 in.
  const m = modifiedGeometry(4.5, 8, 13.5);
  near(m.aPrime, 8, 0.01, 'modified contact radius');    // book: 8 in
  near(m.h1Prime, 14.2, 0.01, 'modified thickness');     // book: 14.2 in
});

test('Example 6.5 — the equal-strain ESWL from the chart conversion factor', () => {
  // Book reads C = 1.50 off Figure 2.23 and gets 6750 lb.
  near(eswlEqualStrain(4500, 1.50), 6750, 1e-9, 'ESWL');
});

/* ──────────── The disagreement, which is the point of the tool ─────────── */

test('the four criteria span about a third of the load', () => {
  const c = compareEswl(EX.Pd, EX.z, EX.Sd, EX.a, 1.50, 0.5);
  near(c.totalLoad, 9000, 1e-12, 'total load');
  // Book values: 7410, 5630, 7340, 6750 — a range of 5630 to 7410.
  assert.ok(c.range[0] < 6000, `lowest criterion ${c.range[0].toFixed(0)} should be near 5600`);
  assert.ok(c.range[1] > 7200, `highest criterion ${c.range[1].toFixed(0)} should be near 7400`);
  assert.ok(c.spreadPct > 20,
    `the criteria should disagree materially; got ${c.spreadPct.toFixed(0)}%`);
});

test('Boyd and Foster sits above the theoretical stress answer, as Huang notes', () => {
  // "the method gives an ESWL greater than the theoretical value and is
  // therefore on the safe side".
  const c = compareEswl(EX.Pd, EX.z, EX.Sd, EX.a);
  assert.ok(c.boydFoster > c.equalStress.eswl,
    'the empirical method is the more conservative of the two');
});

test('the strain criterion is skipped when no chart factor is supplied', () => {
  const c = compareEswl(EX.Pd, EX.z, EX.Sd, EX.a);
  assert.equal(c.equalStrain, null, 'C is a chart read, not something to invent');
  const withC = compareEswl(EX.Pd, EX.z, EX.Sd, EX.a, 1.5);
  near(withC.equalStrain, 6750, 1e-9, 'and is included when it is supplied');
});

/* ───────────────────────────── Behavior ───────────────────────────────── */

test('every criterion returns Pd for a very thin pavement', () => {
  // With almost no cover the two tires act independently.
  const thin = compareEswl(EX.Pd, 1.0, EX.Sd, EX.a);
  near(thin.boydFoster, 4500, 1e-9, 'Boyd and Foster at z < d/2');
  assert.ok(thin.equalStress.eswl < 1.15 * EX.Pd,
    'and the theoretical stress answer is close to one wheel too');
});

test('every criterion approaches the total load for a very thick pavement', () => {
  const thick = compareEswl(EX.Pd, 200, EX.Sd, EX.a);
  near(thick.boydFoster, 9000, 1e-9, 'Boyd and Foster at z > 2Sd');
  assert.ok(thick.equalStress.eswl > 0.9 * 9000,
    'deep enough, the two bulbs are indistinguishable from one');
});

test('wider spacing lowers the ESWL at a given depth', () => {
  const tight = compareEswl(EX.Pd, EX.z, 12, EX.a);
  const wide = compareEswl(EX.Pd, EX.z, 20, EX.a);
  assert.ok(wide.equalStress.eswl < tight.equalStress.eswl,
    'tires further apart interact less');
});

test('invalid geometry returns null rather than a number', () => {
  assert.equal(compareEswl(0, 13.5, 13.5, 4.5), null);
  assert.equal(compareEswl(4500, 13.5, 13.5, 0), null);
  // Tires that overlap have no clearance, so Boyd and Foster is undefined.
  assert.ok(Number.isNaN(eswlBoydFoster(4500, 13.5, 8, 4.5)));
});
