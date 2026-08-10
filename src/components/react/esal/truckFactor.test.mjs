// Tests for the W-4 truck factor reduction. Run with:
//   node --experimental-strip-types --test src/components/react/esal/truckFactor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { truckFactor, scaleFactors, firstYearEsal } from './truckFactor.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/** A stand-in equivalency factor: the fourth-power rule for single axles. */
const fourthPower = (load, type) => {
  const std = type === 'single' ? 18 : type === 'tandem' ? 33 : 47;
  return Math.pow(load / std, 4);
};

test('scale factors are counted-over-weighed, per axle type', () => {
  const groups = [
    { load: 12, type: 'single', weighed: 100 },
    { load: 18, type: 'single', weighed: 300 },
    { load: 30, type: 'tandem', weighed: 200 },
  ];
  const s = scaleFactors(groups, { counted: { single: 2000, tandem: 1000 }, vehicles: 500 });
  near(s.single, 5, 1e-9, 'single scale');    // 2000 counted / 400 weighed
  near(s.tandem, 5, 1e-9, 'tandem scale');    // 1000 counted / 200 weighed
  near(s.tridem, 1, 1e-9, 'unused type stays 1');
});

test('an 18-kip single axle contributes exactly one ESAL', () => {
  const { factor, totalEsal } = truckFactor(
    [{ load: 18, type: 'single', weighed: 100 }],
    { counted: { single: 100 }, vehicles: 100 },
    fourthPower
  );
  near(totalEsal, 100, 1e-9, 'total ESALs');
  near(factor, 1, 1e-9, 'truck factor');
});

test('scaling up the weighed sample raises the truck factor proportionally', () => {
  const groups = [{ load: 18, type: 'single', weighed: 50 }];
  const unscaled = truckFactor(groups, { counted: { single: 50 }, vehicles: 100 }, fourthPower);
  const scaled = truckFactor(groups, { counted: { single: 500 }, vehicles: 100 }, fourthPower);
  near(scaled.factor / unscaled.factor, 10, 1e-9, 'ten times the axles, ten times the factor');
});

test('mixed axle types are scaled independently', () => {
  const groups = [
    { load: 18, type: 'single', weighed: 10 },
    { load: 33, type: 'tandem', weighed: 10 },
  ];
  const r = truckFactor(
    groups,
    { counted: { single: 100, tandem: 20 }, vehicles: 100 },
    fourthPower
  );
  // Singles scale ×10 → 100 ESALs; tandems scale ×2 → 20 ESALs.
  near(r.rows[0].esal, 100, 1e-9, 'single group ESALs');
  near(r.rows[1].esal, 20, 1e-9, 'tandem group ESALs');
  near(r.factor, 1.2, 1e-9, 'truck factor');
});

test('first-year design-lane ESALs apply D, L, and 365 days', () => {
  // 1000 trucks/day, TF = 1.04, 50% directional, 100% lane.
  near(firstYearEsal(1000, 1.04, 0.5, 1.0), 189800, 1e-6, 'first year ESALs');
});
