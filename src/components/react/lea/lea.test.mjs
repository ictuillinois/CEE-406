// Acceptance tests for the layered elastic solver, against the answers
// printed in Huang (2004). Run with:
//   node --experimental-strip-types --test src/components/react/lea/lea.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { besselJ0, besselJ1, besselJ0Zero, besselJ1Zero } from './bessel.ts';
import { leaResponse } from './lea.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

test('Bessel functions match known values', () => {
  near(besselJ0(0), 1, 1e-7, 'J0(0)');
  near(besselJ0(1), 0.7651976866, 1e-7, 'J0(1)');
  near(besselJ0(5), -0.1775967713, 1e-6, 'J0(5)');
  near(besselJ1(0), 0, 1e-7, 'J1(0)');
  near(besselJ1(1), 0.4400505857, 1e-7, 'J1(1)');
  near(besselJ1(5), -0.3275791376, 1e-6, 'J1(5)');
});

test('Bessel zeros match the tabulated values', () => {
  near(besselJ0Zero(1), 2.404825558, 1e-8, 'first zero of J0');
  near(besselJ0Zero(2), 5.520078110, 1e-8, 'second zero of J0');
  near(besselJ1Zero(1), 3.831705970, 1e-8, 'first zero of J1');
  near(besselJ1Zero(2), 7.015586670, 1e-8, 'second zero of J1');
});

test('a two-layer system with equal moduli reproduces Boussinesq', () => {
  // With E1 = E2 and nu1 = nu2 the layered solution must collapse onto the
  // homogeneous half-space, where sigma_z/q = 1 - z^3/(a^2+z^2)^1.5 on axis.
  const layers = [
    { h: 10, E: 10000, nu: 0.35 },
    { h: 0, E: 10000, nu: 0.35 },
  ];
  const q = 100, a = 6;
  for (const z of [3, 6, 12, 20]) {
    const R = leaResponse(layers, q, a, 0, z);
    const boussinesq = q * (1 - Math.pow(z, 3) / Math.pow(a * a + z * z, 1.5));
    near(R.sigZ, boussinesq, 0.01, `sigma_z at z=${z}`);
  }
  // Surface deflection of a flexible circular load: w0 = 2(1-nu^2)qa/E.
  const w0 = leaResponse(layers, q, a, 0, 0).w;
  near(w0, (2 * (1 - 0.35 ** 2) * q * a) / 10000, 0.02, 'surface deflection');
});

test('Huang 2-4: two-layer deflections and interface stress', () => {
  // 10,000 lb on 80 psi; layer 1 = 8 in at 200,000 psi, subgrade 10,000 psi,
  // both incompressible (nu = 0.5).
  // Printed answers: w0 = 0.025 in, w_interface = 0.024 in, sigma_c = 11 psi.
  const a = Math.sqrt(10000 / (Math.PI * 80));
  const layers = [
    { h: 8, E: 200000, nu: 0.5 },
    { h: 0, E: 10000, nu: 0.5 },
  ];
  const surf = leaResponse(layers, 80, a, 0, 0);
  const iface = leaResponse(layers, 80, a, 0, 8);
  near(surf.w, 0.025, 0.10, 'surface deflection');
  near(iface.w, 0.024, 0.10, 'interface deflection');
  near(iface.sigZ, 11, 0.15, 'interface vertical stress');
});

test('Huang 2-6: three-layer critical strains', () => {
  // 5.75 in HMA at 400,000 psi over 23 in base at 20,000 psi over subgrade at
  // 10,000 psi, all nu = 0.5, under 40,000 lb at 150 psi.
  // Printed answers: horizontal tensile strain at the bottom of the HMA
  // = -7.25e-4, vertical compressive strain on top of the subgrade = 1.06e-3.
  const a = Math.sqrt(40000 / (Math.PI * 150));
  const layers = [
    { h: 5.75, E: 400000, nu: 0.5 },
    { h: 23, E: 20000, nu: 0.5 },
    { h: 0, E: 10000, nu: 0.5 },
  ];
  const acBottom = leaResponse(layers, 150, a, 0, 5.75);
  const sgTop = leaResponse(layers, 150, a, 0, 28.75);
  // Huang reports tension as negative for the radial strain at the AC bottom.
  near(Math.abs(acBottom.epsR), 7.25e-4, 0.15, 'tensile strain at AC bottom');
  near(Math.abs(sgTop.epsZ), 1.06e-3, 0.15, 'compressive strain on subgrade');
});

test('vertical stress decays monotonically with depth', () => {
  const layers = [
    { h: 6, E: 500000, nu: 0.35 },
    { h: 12, E: 25000, nu: 0.4 },
    { h: 0, E: 8000, nu: 0.45 },
  ];
  let prev = Infinity;
  for (const z of [0.5, 2, 5, 8, 14, 20, 30, 45]) {
    const R = leaResponse(layers, 100, 6, 0, z);
    assert.ok(R.sigZ > 0, `sigma_z should stay compressive at z=${z}`);
    assert.ok(R.sigZ < prev, `sigma_z should decrease at z=${z} (got ${R.sigZ} after ${prev})`);
    prev = R.sigZ;
  }
});
