// Acceptance tests for the AASHTO design equations, checked against the
// answers printed in Huang (2004). Run with:
//   node --test src/components/react/aashto/equations.test.mjs
// (equations.ts is type-stripped by Node's built-in TypeScript support.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zOfR, rOfZ, logW18Flex, snFor, logW18Rigid, dFor, kOfMr, effectiveK,
} from './equations.ts';

/**
 * Assert `actual` is within `tol` (relative) of `expected`.
 *
 * The absolute floor makes an expected value of 0 testable: zOfR(50) is
 * mathematically 0 but comes back as ~1e-9, the residual of the Halley
 * refinement running against an approximate normal CDF. That is noise on a
 * quantity of order 1, not an error worth failing over.
 */
const near = (actual, expected, tol, what) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.max(Math.abs(expected) * tol, 1e-8),
    `${what}: got ${actual}, expected ~${expected} (±${tol * 100}%)`
  );

test('reliability ↔ Z_R round-trips and matches the AASHTO table', () => {
  // AASHTO 1993 Table 4.1 standard normal deviates.
  near(zOfR(50), 0, 1e-6, 'Z_R at R=50%');
  near(zOfR(90), -1.282, 0.002, 'Z_R at R=90%');
  near(zOfR(95), -1.645, 0.002, 'Z_R at R=95%');
  near(zOfR(99), -2.327, 0.002, 'Z_R at R=99%');
  near(rOfZ(zOfR(88)), 88, 1e-6, 'round trip');
});

test('Huang 11-9: full-depth AC, solve for reliability → 88%', () => {
  // 12 in full-depth AC, a1 = 0.44 → SN = 5.28; M_R = 10,000 psi;
  // PSI 4.2 → 2.5; S0 = 0.5; W18 = 3e7.
  const SN = 0.44 * 12;
  const withoutZ = logW18Flex(SN, 10000, 4.2 - 2.5, 0, 0.5);
  const z = (Math.log10(3e7) - withoutZ) / 0.5;
  near(rOfZ(z), 88, 0.02, 'reliability');
});

test('Huang 11-12: solve for SN at R = 50% → 4.2 mainline, 2.4 shoulder', () => {
  const dPSI = 1.7, MR = 5000, z = zOfR(50), s0 = 0.5;
  near(snFor(5e6, MR, dPSI, z, s0), 4.2, 0.02, 'mainline SN');
  // Shoulder carries encroaching (2.5%) plus parking (0.02%) traffic.
  const shoulderESAL = 5e6 * (0.025 + 0.0002);
  near(snFor(shoulderESAL, MR, dPSI, z, s0), 2.4, 0.05, 'shoulder SN');
});

test('flexible equation inverts consistently', () => {
  const dPSI = 1.9, MR = 7500, z = zOfR(95), s0 = 0.45;
  for (const sn of [2, 3.5, 5, 6.5]) {
    const w = Math.pow(10, logW18Flex(sn, MR, dPSI, z, s0));
    near(snFor(w, MR, dPSI, z, s0), sn, 1e-6, `SN round trip at SN=${sn}`);
  }
});

test('Huang 12-7: rigid performance traffic without the reliability term → 8.5e6', () => {
  // PCC 8 in, Ec = 4e6 psi, Sc' = 650 psi, J = 3.2, PSI 4.5 → 2.0,
  // poor drainage with 5% of time near saturation.
  // k is read from Huang Fig. 12.18 for an 8 in granular subbase
  // (Esb = 30,000 psi) over a subgrade with MR = 5000 psi.
  const k = 170, Cd = 1.0;
  const lw = logW18Rigid(8, k, 4e6, 650, 3.2, Cd, 4.5 - 2.0, 2.0, 0, 0.3);
  near(Math.pow(10, lw), 8.5e6, 0.25, 'W18 without reliability');
});

test('rigid equation inverts consistently', () => {
  const args = [150, 4e6, 650, 3.2, 1.0, 2.5, 2.5, zOfR(95), 0.35];
  for (const d of [7, 9, 11, 13]) {
    const w = Math.pow(10, logW18Rigid(d, ...args));
    near(dFor(w, ...args), d, 1e-6, `D round trip at D=${d}`);
  }
});

test('Huang 12-8: effective modulus of subgrade reaction → ~305 pci', () => {
  const monthlyMr = [15900, 27300, 38700, 50000, 900, 1620, 2340, 3060, 3780, 4500, 4500, 4500];
  const ks = monthlyMr.map(kOfMr);
  const kEff = effectiveK(8.5, ks);
  // The text reports 305 pci, read off the Fig. 12.20 chart; solving Eq. 12.30
  // directly gives ~300, so allow the chart-reading difference.
  near(kEff, 305, 0.05, 'effective k');
  // The effective k must sit far below the arithmetic mean of the seasonal
  // values — that is the entire point of the relative damage method.
  const mean = ks.reduce((a, b) => a + b, 0) / ks.length;
  assert.ok(kEff < mean / 2, `effective k ${kEff} should be well under the mean ${mean}`);
});
