// Acceptance tests for the one-layer (Boussinesq) half-space, against the
// closed forms and the chart reads printed in Huang (2004) Chapter 2. Run:
//   node --experimental-strip-types --test src/components/react/lea/oneLayer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oneLayerResponse, principalAt, superposeOneLayer, principalOfTensor,
  sigZRatio, sigRRatio, sigTRatio, deflectionFactorAt,
  rigidPlateDeflection, CHART_NU,
} from './oneLayer.ts';
import { leaResponse } from './lea.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

const abs = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= tol, `${what}: got ${a}, expected ${e} ±${tol}`);

/* ── The axis, where Huang prints closed forms ──────────────────────────── */

test('on the axis it reproduces Huang Eqs. 2.2, 2.3 and 2.6 exactly', () => {
  const q = 50, a = 5, E = 10000;
  for (const nu of [0.3, 0.4, 0.5]) {
    for (const z of [0.5, 2, 5, 10, 25]) {
      const R = Math.sqrt(a * a + z * z);
      const zr3 = z ** 3 / R ** 3;
      // Eq. 2.2
      const sigZ = q * (1 - zr3);
      // Eq. 2.3
      const sigR = (q / 2) * (1 + 2 * nu - (2 * (1 + nu) * z) / R + zr3);
      // Eq. 2.6
      const w = (((1 + nu) * q * a) / E) * (a / R + ((1 - 2 * nu) * (R - z)) / a);

      const got = oneLayerResponse(0, z, q, a, E, nu);
      near(got.sigZ, sigZ, 1e-7, `sigma_z at z=${z}, nu=${nu}`);
      near(got.sigR, sigR, 1e-6, `sigma_r at z=${z}, nu=${nu}`);
      near(got.sigT, sigR, 1e-6, `sigma_t = sigma_r on the axis, z=${z}`);
      near(got.w, w, 1e-7, `w at z=${z}, nu=${nu}`);
      abs(got.tauRZ, 0, 1e-12, `tau_rz vanishes on the axis, z=${z}`);
    }
  }
});

test('Example 2.2: the printed solution, including the tension at nu = 0.3', () => {
  // 10-in circle, 50 psi, E = 10,000 psi, nu = 0.3, point 10 in below center.
  // Printed: sigma_z = 14.2 psi, sigma_r = -0.25 psi (TENSION), eps_z = 0.00144,
  // eps_r = -0.00044, w = 0.0176 in.
  const R = oneLayerResponse(0, 10, 50, 5, 10000, 0.3);
  near(R.sigZ, 14.2, 0.01, 'sigma_z');
  abs(R.sigR, -0.25, 0.02, 'sigma_r (negative = tension)');
  const E = 10000, nu = 0.3;
  const epsZ = (R.sigZ - nu * (R.sigR + R.sigT)) / E;
  const epsR = (R.sigR - nu * (R.sigZ + R.sigT)) / E;
  near(epsZ, 0.00144, 0.02, 'eps_z');
  abs(epsR, -0.00044, 2e-5, 'eps_r');
  near(R.w, 0.0176, 0.01, 'w');
});

test('Example 2.3: a rigid plate deflects 79% as much (Eq. 2.10)', () => {
  // 12-in plate, 8000 lb, deflection 0.1 in, nu = 0.4 -> E = 5600 psi.
  const q = 8000 / (36 * Math.PI);
  const E = (Math.PI * (1 - 0.16) * q * 6) / (2 * 0.1);
  near(E, 5600, 0.01, 'back-figured subgrade modulus');
  near(rigidPlateDeflection(q, 6, E, 0.4), 0.1, 1e-9, 'round trip');
});

/* ── Off the axis, where Huang prints charts ────────────────────────────── */

test('Example 2.1: every chart read in the worked example reproduces', () => {
  // Huang reads Figures 2.2, 2.3, 2.4 and 2.6 at two stations. These are the
  // acceptance anchors for the chart module: if these move, a redrawn chart
  // is no longer the book's chart.
  //          r/a  z/a   sigma_z/q  sigma_r/q  sigma_t/q   F
  // left     0    2     0.28       0.016      —           0.68
  // right    4    2     0.0076     0.026      0 (reads 0) 0.21
  abs(sigZRatio(0, 2), 0.28, 0.005, 'Fig 2.2 at r/a = 0, z/a = 2');
  abs(sigRRatio(0, 2), 0.016, 0.001, 'Fig 2.3 at r/a = 0, z/a = 2');
  abs(deflectionFactorAt(0, 2), 0.68, 0.01, 'Fig 2.6 at r/a = 0, z/a = 2');

  abs(sigZRatio(4, 2), 0.0076, 0.0005, 'Fig 2.2 at r/a = 4, z/a = 2');
  abs(sigRRatio(4, 2), 0.026, 0.002, 'Fig 2.3 at r/a = 4, z/a = 2');
  abs(sigTRatio(4, 2), 0, 0.001, 'Fig 2.4 at r/a = 4, z/a = 2 (reads zero)');
  abs(deflectionFactorAt(4, 2), 0.21, 0.01, 'Fig 2.6 at r/a = 4, z/a = 2');

  // ...and the example's own arithmetic, superposed.
  const q = 50, a = 5, E = 10000, nu = 0.5;
  const sup = superposeOneLayer(
    [{ x: 0, y: 0 }, { x: 20, y: 0 }], { x: 0, y: 0, z: 10 }, q, a, E, nu
  );
  near(sup.sz, 14.38, 0.02, 'superposed sigma_z (printed 14.38 psi)');
  const epsZ = (sup.sz - nu * (sup.sx + sup.sy)) / E;
  near(epsZ, 0.00129, 0.03, 'superposed eps_z (printed 0.00129)');
  near(sup.w, 0.022, 0.03, 'superposed deflection (printed 0.022 in)');
});

test('Problem 2.1: the principal state under the edge, and where the book differs', () => {
  // r = a, z = 2a, nu = 0.5. Huang prints w = 0.58 qa/E and principal stresses
  // 0.221q, 0.011q, 0.004q, read off Ahlvin and Ulery's tables.
  //
  // Two independent solvers here — this module's Hankel integrals and the
  // n-layer solve in lea.ts run with two identical layers — agree to five
  // decimals on 0.22805, 0.01082, 0.00919 and w = 0.57207. The printed
  // sigma_3 is 2.3x smaller than the computed one; both are tiny, and the
  // discrepancy is the table read, not the mechanics. Recorded, not corrected.
  const R = oneLayerResponse(1, 2, 1, 1, 1, 0.5);
  const P = principalAt(R, 1, 0.5);
  abs(P.sig[0], 0.22805, 1e-4, 'sigma_1 (book prints 0.221)');
  abs(P.sig[1], 0.01082, 1e-4, 'sigma_2 (book prints 0.011)');
  abs(P.sig[2], 0.00919, 1e-4, 'sigma_3 (book prints 0.004)');
  abs(R.w, 0.57207, 1e-4, 'w/(qa/E) (book prints 0.58)');

  // Incompressible: the strains must sum to zero.
  abs(P.eps[0] + P.eps[1] + P.eps[2], 0, 1e-9, 'sum of principal strains at nu = 0.5');

  // The book's own numbers, kept close enough that a student reading the
  // chart and a student running the tool land in the same place.
  abs(P.sig[0], 0.221, 0.008, 'sigma_1 within a chart read of the printed value');
  abs(R.w, 0.58, 0.01, 'w within a chart read of the printed value');
});

test('agrees with the independent n-layer solver across the chart domain', () => {
  // lea.ts solves the same Appendix B system by assembling and inverting the
  // interface conditions; this module solves the n = 1 specialization in
  // closed form. They share only bessel.ts, so agreement is a real check.
  const homogeneous = [
    { h: 5, E: 1, nu: 0.5 },
    { h: 0, E: 1, nu: 0.5 },
  ];
  for (const ra of [0, 0.5, 1, 2, 4]) {
    for (const za of [0.5, 1, 2, 5]) {
      const mine = oneLayerResponse(ra, za, 1, 1, 1, 0.5);
      const theirs = leaResponse(homogeneous, 1, 1, ra, za, { cycles: 200 });
      abs(mine.sigZ, theirs.sigZ, 5e-4, `sigma_z at (${ra}, ${za})`);
      abs(mine.sigR, theirs.sigR, 5e-4, `sigma_r at (${ra}, ${za})`);
      abs(mine.sigT, theirs.sigT, 5e-4, `sigma_t at (${ra}, ${za})`);
      abs(mine.tauRZ, theirs.tauRZ, 5e-4, `tau_rz at (${ra}, ${za})`);
      abs(mine.w, theirs.w, 5e-4, `w at (${ra}, ${za})`);
    }
  }
});

/* ── The surface, which the quadrature cannot reach ─────────────────────── */

test('z = 0 is exact, not the undamped integral', () => {
  // Inside the circle the plate pressure is carried directly; outside it the
  // vertical stress is zero. The integrals have no e^(-mz) at z = 0 and
  // converge only conditionally, so these come from the closed forms.
  for (const nu of [0.3, 0.5]) {
    abs(oneLayerResponse(0, 0, 100, 6, 1e4, nu).sigZ, 100, 1e-9, `sigma_z at the center, nu=${nu}`);
    abs(oneLayerResponse(3, 0, 100, 6, 1e4, nu).sigZ, 100, 1e-9, `sigma_z inside, nu=${nu}`);
    abs(oneLayerResponse(6, 0, 100, 6, 1e4, nu).sigZ, 50, 1e-9, `sigma_z on the rim, nu=${nu}`);
    abs(oneLayerResponse(9, 0, 100, 6, 1e4, nu).sigZ, 0, 1e-9, `sigma_z outside, nu=${nu}`);
  }
  // Eq. 2.3 at z = 0 inside the circle.
  abs(oneLayerResponse(0, 0, 100, 6, 1e4, 0.5).sigR, 100, 1e-9, 'sigma_r at the center, nu = 0.5');
  abs(oneLayerResponse(0, 0, 100, 6, 1e4, 0.3).sigR, 80, 1e-9, 'sigma_r at the center, nu = 0.3');
  // At nu = 0.5 the surface outside the load carries no horizontal stress —
  // which is why every curve in Figure 2.3 runs off the left of the chart.
  abs(oneLayerResponse(12, 0, 100, 6, 1e4, 0.5).sigR, 0, 1e-12, 'sigma_r outside at nu = 0.5');
  // Eq. 2.8: the flexible-plate surface deflection.
  near(oneLayerResponse(0, 0, 100, 6, 1e4, 0.35).w,
    (2 * (1 - 0.35 ** 2) * 100 * 6) / 1e4, 1e-3, 'w0 = 2(1-nu^2)qa/E');
});

/* ── Chart-domain sanity, so a redrawn curve cannot be nonsense ─────────── */

test('the charted quantities behave the way the charts show', () => {
  // sigma_z falls monotonically with depth on the axis and with radius at
  // every depth — the two facts that make Figure 2.2 invertible for r/a.
  let prev = Infinity;
  for (const za of [0.1, 0.5, 1, 2, 4, 6, 10]) {
    const v = sigZRatio(0, za);
    assert.ok(v < prev, `sigma_z/q should fall with depth at z/a=${za}`);
    prev = v;
  }
  for (const za of [0.5, 1, 2, 5, 10]) {
    let last = Infinity;
    for (const ra of [0, 0.25, 0.5, 1, 1.5, 2, 3, 5, 10]) {
      const v = sigZRatio(ra, za);
      assert.ok(v < last, `sigma_z/q should fall with r/a at z/a=${za}, r/a=${ra}`);
      last = v;
    }
  }
  // Everything the charts plot on a log axis must be positive there.
  for (const za of [0.25, 1, 3, 10]) {
    for (const ra of [0, 0.5, 1, 2, 5, 10]) {
      assert.ok(sigZRatio(ra, za) > 0, `sigma_z/q > 0 at (${ra}, ${za})`);
      assert.ok(sigRRatio(ra, za) > 0, `sigma_r/q > 0 at (${ra}, ${za}) — nu = 0.5`);
      assert.ok(deflectionFactorAt(ra, za) > 0, `F > 0 at (${ra}, ${za})`);
    }
  }
  // sigma_t stays compressive everywhere at nu = 0.5, but it collapses much
  // faster with radius than sigma_z does — at z/a = 0.05 it has already
  // fallen to 0.08% of q by r/a = 2. That, not a change of sign, is why
  // Figure 2.4 covers only r/a <= 2.5 and z/a <= 5 while Figure 2.3 runs to
  // r/a = 10 and z/a = 10: the rest of the surface would be off the scale.
  assert.ok(sigTRatio(2, 0.05) < 0.001, 'sigma_t is off Figure 2.4 scale by r/a = 2');
  assert.ok(sigTRatio(2.5, 1) > sigTRatio(2.5, 0.25),
    'the r/a = 2.5 curve hooks back — sigma_t peaks below the surface');
});

test('principalOfTensor matches the axisymmetric Mohr circle', () => {
  const R = oneLayerResponse(1.5, 1.2, 1, 1, 1, 0.4);
  const viaMohr = principalAt(R, 1, 0.4).sig;
  const viaCubic = principalOfTensor(R.sigR, R.sigT, R.sigZ, 0, R.tauRZ, 0);
  for (let i = 0; i < 3; i++) abs(viaCubic[i], viaMohr[i], 1e-9, `principal ${i + 1}`);
});
