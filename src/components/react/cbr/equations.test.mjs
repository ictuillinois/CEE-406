// Tests for the CBR reduction. Run with:
//   node --experimental-strip-types --test src/components/react/cbr/equations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceCbr, originCorrection, pressureAt, STANDARD_PRESSURE } from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-8),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

test('a straight curve through the origin needs no correction', () => {
  const pts = [
    { pen: 0, load: 0 }, { pen: 0.05, load: 250 }, { pen: 0.1, load: 500 },
    { pen: 0.15, load: 750 }, { pen: 0.2, load: 1000 },
  ];
  const { offset } = originCorrection(pts);
  near(offset, 0, 1e-6, 'offset');

  const r = reduceCbr(pts);
  near(r.p01, 500, 1e-6, 'pressure at 0.1 in');
  near(r.cbr01, 50, 1e-6, 'CBR at 0.1 in');
  // 1000/1500 = 66.7% > 50%, so the 0.2 in value governs and a rerun is advised.
  near(r.cbr02, 66.667, 1e-3, 'CBR at 0.2 in');
  assert.equal(r.governingAt, '0.2');
  assert.equal(r.rerunAdvised, true);
});

test('a concave-up curve is shifted to the corrected origin', () => {
  // Straight line of slope 10000 psi/in starting at a penetration of 0.03 in,
  // preceded by a soft toe. The correction should recover offset = 0.03.
  const pts = [
    { pen: 0, load: 0 },
    { pen: 0.02, load: 40 },
    { pen: 0.04, load: 100 },
    { pen: 0.06, load: 300 },
    { pen: 0.08, load: 500 },
    { pen: 0.10, load: 700 },
    { pen: 0.13, load: 1000 },
    { pen: 0.23, load: 2000 },
  ];
  const { offset } = originCorrection(pts);
  near(offset, 0.03, 0.05, 'corrected origin');

  const r = reduceCbr(pts);
  // At a corrected penetration of 0.1 in the raw penetration is 0.13 in,
  // where the measured pressure is 1000 psi → CBR = 100%.
  near(r.p01, 1000, 0.02, 'corrected pressure at 0.1 in');
  near(r.cbr01, 100, 0.02, 'corrected CBR');

  // Without the correction the same data reads far too low.
  const raw = reduceCbr(pts, false);
  assert.ok(raw.cbr01 < r.cbr01, 'uncorrected CBR should be lower');
  near(raw.cbr01, 70, 0.02, 'uncorrected CBR at 0.1 in');
});

test('standard pressures match AASHTO T 193', () => {
  assert.equal(STANDARD_PRESSURE['0.1'], 1000);
  assert.equal(STANDARD_PRESSURE['0.2'], 1500);
  assert.equal(STANDARD_PRESSURE['0.3'], 1900);
});

test('interpolation is linear between readings and clamps outside them', () => {
  const pts = [{ pen: 0.1, load: 100 }, { pen: 0.2, load: 200 }];
  near(pressureAt(pts, 0.15), 150, 1e-9, 'midpoint');
  near(pressureAt(pts, 0.05), 100, 1e-9, 'below range clamps');
  near(pressureAt(pts, 0.5), 200, 1e-9, 'above range clamps');
});
