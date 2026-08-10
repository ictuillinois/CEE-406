// Acceptance tests for the drainage equations, against Huang's printed
// answers. Run with:
//   node --experimental-strip-types --test src/components/react/drainage/equations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  infiltrationRidgeway, infiltrationCedergren, groundwaterAboveDrain,
  radiusOfInfluence, consolidationPressure, meltwaterInflow, designInflow,
  drainageCapacity, pipeCapacity, maxLateralInflow, filterCriteria,
  slopeFactor, timeToDrain,
} from './equations.ts';

const near = (actual, expected, tol, what) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.max(Math.abs(expected) * tol, 1e-9),
    `${what}: got ${actual}, expected ~${expected} (±${tol * 100}%)`
  );

test('Huang Example 8.6: two-lane concrete, Wp = 24 ft, Cs = 15 ft', () => {
  const r = infiltrationRidgeway(2, 24, 15);
  near(r.qLinear, 0.46, 0.01, 'q per linear ft');
  near(r.qArea, 0.0192, 0.02, 'q per unit area');
});

test('Huang Problem 8.6: two-lane HMA highway → 0.016 ft³/h/ft²', () => {
  // Fig. P8.6: 22 ft of traffic lanes with 9 ft shoulders, all HMA.
  // W_p is the width subject to infiltration (the traffic lanes) and the
  // joint spacing for asphalt is 40 ft.
  const r = infiltrationRidgeway(2, 22, 40);
  near(r.qArea, 0.016, 0.02, 'Ridgeway infiltration');

  // Cedergren's method for the same site, at a 1-h/1-yr rate of 1.2 in/h,
  // brackets 0.033-0.05 ft³/h/ft² over the asphalt coefficient range.
  near(infiltrationCedergren(1.2, 0.33), 0.033, 0.02, 'Cedergren low');
  near(infiltrationCedergren(1.2, 0.50), 0.050, 0.02, 'Cedergren high');
});

test('Huang Example 8.7: groundwater above the drain', () => {
  // Silty sand k = 0.34 ft/day, H = 25 ft, H0 = 20 ft.
  near(radiusOfInfluence(25, 20), 19, 0.01, 'radius of influence L_i');
  near(groundwaterAboveDrain(0.34, 25, 20), 0.22, 0.02, 'q1');
});

test('Huang Problem 8.8: meltwater from ice lenses → 0.067 ft³/day/ft²', () => {
  // GW-GC subgrade with 4% finer than 0.02 mm → heave rate 2.5 mm/day
  // (Table 8.5). HMA 4 in at 145 pcf over 10 in of drainage layer at 120 pcf.
  const sigmaP = consolidationPressure([{ t: 4, g: 145 }, { t: 10, g: 120 }]);
  near(sigmaP, 148.3, 0.01, 'consolidation pressure');

  // Fig. 8.15 at 2.5 mm/day and ~150 psf gives q_m/√k ≈ 0.30.
  near(meltwaterInflow(0.30, 0.05), 0.067, 0.02, 'meltwater inflow');
});

test('Huang Example 8.8 anchors the same chart step', () => {
  // Silty sand, 9% finer than 0.02 mm → heave 9 mm/day; concrete 9 in at
  // 150 pcf over 6 in at 115 pcf → σ_p = 170 psf; Fig. 8.15 → q_m/√k = 0.74.
  near(consolidationPressure([{ t: 9, g: 150 }, { t: 6, g: 115 }]), 170, 0.01, 'σ_p');
  near(meltwaterInflow(0.74, 0.34), 0.43, 0.02, 'meltwater inflow');
});

test('Huang Example 8.9: design inflow combines the right terms', () => {
  const { noFrost, frost, governing } = designInflow(0.46, 0.057, 0.43);
  near(noFrost, 0.517, 0.01, 'no frost q_d');
  near(frost, 0.89, 0.01, 'frost q_d');
  near(governing, 0.89, 0.01, 'governing q_d');
});

test('Huang Problem 8.9: capacity and time to drain', () => {
  // H = 8 in, S = 4%, k = 10,000 ft/day, L = 18 ft, n_e = 25%.
  near(drainageCapacity(10000, 8 / 12, 0.04, 18), 390, 0.02, 'capacity');
  near(slopeFactor(18, 0.04, 8 / 12), 1.08, 0.01, 'slope factor S1');
  // Printed answers are 0.07 h to 50% and 0.44 h to 95% drainage; those
  // correspond to time factors of 0.24 and 1.51 on the S1 = 1.08 curve.
  near(timeToDrain(0.25, 18, 10000, 8 / 12, 0.24) * 24, 0.07, 0.03, 't50');
  near(timeToDrain(0.25, 18, 10000, 8 / 12, 1.51) * 24, 0.44, 0.03, 't95');
});

test('Huang Problem 8.10: 4-in plastic pipe → 112.7 ft³/day/ft', () => {
  // n = 0.01, S = 2.5%, outlets every 300 ft.
  const q = maxLateralInflow(4, 0.01, 0.025, 300);
  near(q, 112.7, 0.01, 'max allowable lateral inflow');
  // Sanity: the full-flow capacity itself.
  near(pipeCapacity(4, 0.01, 0.025).cfs, 0.391, 0.02, 'full flow');
});

test('filter criteria flag a filter that pipes', () => {
  // A filter far too coarse for the soil fails the piping check.
  const bad = filterCriteria({ d15: 2, d50: 5, d85: 10 }, { d15: 0.02, d50: 0.1, d85: 0.2 });
  assert.equal(bad.allPass, false);
  assert.equal(bad.checks[0].pass, false, 'piping check should fail');
  assert.equal(bad.checks[1].pass, true, 'permeability check should pass');

  // A well-graded filter passes all three.
  const good = filterCriteria({ d15: 0.5, d50: 1.5, d85: 3 }, { d15: 0.05, d50: 0.2, d85: 0.4 });
  assert.equal(good.allPass, true);
});
