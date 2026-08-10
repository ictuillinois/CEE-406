// Acceptance tests for the PCA method, against Huang's worked examples.
// Run with:
//   node --experimental-strip-types --test src/components/react/pca/equations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  powerFromPressure, powerFromErosionFactor, erosionAllowable,
  fatigueAllowable, pcaAnalyse,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

test('Huang Example 12.1: erosion by the equation route', () => {
  // h = 8 in, k = 100 pci. Corner deflection 0.0353 in under an 18-kip
  // single axle → p = k·w = 3.53 psi.
  near(powerFromPressure(3.53, 8, 100), 14.512, 0.01, 'P for the single axle');
  const N1 = erosionAllowable(14.512, 1.0);
  near(Math.log10(N1), 6.444, 0.01, 'log N, single');
  near(N1, 2.78e6, 0.02, 'allowable N, single');
  // Percent erosion damage for 5e6 predicted repetitions, C2 = 0.06.
  near((100 * 0.06 * 5e6) / N1, 10.8, 0.02, 'erosion damage, single');

  // 36-kip tandem: corner deflection 0.0458 in → p = 4.58 psi.
  near(powerFromPressure(4.58, 8, 100), 24.429, 0.01, 'P for the tandem axle');
  const N2 = erosionAllowable(24.429, 1.0);
  near(Math.log10(N2), 5.541, 0.01, 'log N, tandem');
  near((100 * 0.06 * 5e6) / N2, 86.5, 0.02, 'erosion damage, tandem');
});

test('Huang Example 12.3: the erosion-factor route agrees with the equation route', () => {
  // Table 12.8 at h = 8 in, k = 100, doweled, no shoulders: 2.82 / 2.99.
  // Figure 12.13 gives 3e7 and 6.2e6 allowable repetitions — those already
  // include the division by C2 = 0.06.
  const Nsingle = erosionAllowable(powerFromErosionFactor(2.82), 1.0) / 0.06;
  const Ntandem = erosionAllowable(powerFromErosionFactor(2.99), 1.0) / 0.06;
  near(Nsingle, 3.0e7, 0.10, 'allowable repetitions, single');
  near(Ntandem, 6.2e6, 0.10, 'allowable repetitions, tandem');

  // And the resulting damages match Example 12.3's 16.7% and 80.6%.
  near((100 * 5e6) / Nsingle, 16.7, 0.10, 'erosion damage, single');
  near((100 * 5e6) / Ntandem, 80.6, 0.10, 'erosion damage, tandem');
});

test('fatigue criterion matches the PCA stress-ratio bands', () => {
  assert.equal(fatigueAllowable(0.40), Infinity, 'below 0.45 is unlimited');
  // Huang p.553: a stress ratio factor of 0.498 on the standard axle reads
  // about 7e5 repetitions off Figure 12.12.
  const N = fatigueAllowable(0.498);
  assert.ok(N > 4e5 && N < 1.2e6, `expected ~7e5 from the chart, got ${N}`);
  // The two branches must meet at the 0.55 boundary.
  near(fatigueAllowable(0.5499), fatigueAllowable(0.5501), 0.02, 'branch continuity');
  // Higher stress ratio must always mean fewer allowable repetitions.
  let prev = Infinity;
  for (const sr of [0.46, 0.5, 0.55, 0.6, 0.7, 0.8]) {
    const n = fatigueAllowable(sr);
    assert.ok(n < prev, `N should fall as SR rises (SR=${sr})`);
    prev = n;
  }
});

test('an axle at the standard load reproduces the table value directly', () => {
  const input = {
    equivalentStress: { single: 206, tandem: 192 },
    erosionFactor: { single: 2.82, tandem: 2.99 },
    modulusOfRupture: 650,
    lsf: 1.0,
    c1: 1.0,
    c2: 0.06,
  };
  const { rows } = pcaAnalyse([{ load: 18, type: 'single', reps: 1000 }], input);
  near(rows[0].stress, 206, 1e-9, 'stress equals the table value at 18 kip');
  near(rows[0].stressRatio, 206 / 650, 1e-9, 'stress ratio factor');
});

test('the load safety factor scales the load, not the ratio', () => {
  const base = {
    equivalentStress: { single: 200, tandem: 190 },
    erosionFactor: { single: 2.8, tandem: 3.0 },
    modulusOfRupture: 650, lsf: 1.0, c1: 1.0, c2: 0.06,
  };
  const g = [{ load: 18, type: 'single', reps: 1000 }];
  const a = pcaAnalyse(g, base);
  const b = pcaAnalyse(g, { ...base, lsf: 1.2 });
  near(b.rows[0].stress / a.rows[0].stress, 1.2, 1e-9, 'stress scales with LSF');
  // Power goes as load squared.
  near(b.rows[0].power / a.rows[0].power, 1.44, 1e-9, 'power scales with LSF squared');
});

test('both analyses must pass for the section to be adequate', () => {
  const input = {
    equivalentStress: { single: 206, tandem: 192 },
    erosionFactor: { single: 2.82, tandem: 2.99 },
    modulusOfRupture: 650, lsf: 1.2, c1: 1.0, c2: 0.06,
  };
  const heavy = pcaAnalyse([
    { load: 30, type: 'single', reps: 500000 },
    { load: 50, type: 'tandem', reps: 900000 },
  ], input);
  assert.equal(heavy.adequate, false, 'a heavy spectrum should fail');
  assert.ok(['fatigue', 'erosion'].includes(heavy.governing));

  const light = pcaAnalyse([{ load: 10, type: 'single', reps: 1000 }], input);
  assert.equal(light.adequate, true, 'a light spectrum should pass');
  assert.equal(light.fatigueTotal, 0, 'below the endurance limit there is no fatigue damage');
});
