// Tests for the Boussinesq one-layer response. Run with:
//   node --experimental-strip-types --test src/components/react/stress/equations.test.mjs
//
// Checked against Huang (2004) Example 2.1 (p. 49) and the standard closed
// forms of §2.1.2. HW3 and HW4 both start here, so the half-space solution had
// better be right before anything is layered on top of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  axisResponse, deflectionFactor, surfaceDeflectionFlexible, surfaceDeflectionRigid, sigZAt,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* Example 2.1: two 10-in-diameter circles at 50 psi, 20 in apart, on a
 * half-space with E = 10,000 psi and ν = 0.5. Point A is 10 in below the
 * center of one circle. So a = 5, q = 50, z = 10, i.e. z/a = 2. */
const EX = { q: 50, a: 5, E: 10000, nu: 0.5, z: 10 };

test('Example 2.1 — vertical stress under one load at z/a = 2', () => {
  const r = axisResponse(EX.z, EX.q, EX.a, EX.E, EX.nu);
  // Huang reads 0.28 q off Figure 2.2 → 14.0 psi. The closed form is finer.
  near(r.sigZ, 14.0, 0.03, 'sigma_z');
  near(r.sigZ / EX.q, 0.28, 0.03, 'stress factor sigma_z/q');
});

test('Example 2.1 — the deflection factor Huang reads as 0.68', () => {
  // Figure 2.6 gives F = 0.68 at r/a = 0, z/a = 2, with w = F q a / E.
  near(deflectionFactor(EX.z, EX.a, EX.nu), 0.68, 0.02, 'deflection factor');
  const r = axisResponse(EX.z, EX.q, EX.a, EX.E, EX.nu);
  near(r.w, (0.68 * EX.q * EX.a) / EX.E, 0.02, 'deflection from the factor');
});

test('vertical stress does not depend on E or on nu', () => {
  // Huang: "Note that sigma_z is independent of E and v". A structural
  // property of the solution, and an easy thing to break by refactoring.
  const base = axisResponse(8, 50, 5, 10000, 0.5).sigZ;
  near(axisResponse(8, 50, 5, 500000, 0.5).sigZ, base, 1e-12, 'stiffer half-space');
  near(axisResponse(8, 50, 5, 10000, 0.2).sigZ, base, 1e-12, 'different nu');
});

test('radial stress does not depend on E', () => {
  // Also stated in §2.1.2: sigma_r is independent of E (but not of nu).
  const base = axisResponse(8, 50, 5, 10000, 0.35).sigR;
  near(axisResponse(8, 50, 5, 900000, 0.35).sigR, base, 1e-12, 'stiffer half-space');
  assert.notEqual(axisResponse(8, 50, 5, 10000, 0.2).sigR, base, 'but nu does matter');
});

test('at the surface the full contact pressure is carried', () => {
  const r = axisResponse(0, 50, 5, 10000, 0.5);
  near(r.sigZ, 50, 1e-12, 'sigma_z at z = 0');
});

test('stress decays toward zero with depth', () => {
  const shallow = axisResponse(5, 50, 5, 10000, 0.4).sigZ;
  const deep = axisResponse(50, 50, 5, 10000, 0.4).sigZ;
  assert.ok(deep < shallow, 'deeper is smaller');
  assert.ok(deep / 50 < 0.02, `at z/a = 10 only ${(100 * deep / 50).toFixed(1)}% of q remains`);
});

/* ─────────────────────── Surface deflection forms ───────────────────────── */

test('Eq. 2.8 — flexible plate surface deflection, and the nu = 0.5 shortcut', () => {
  const w = surfaceDeflectionFlexible(50, 5, 10000, 0.5);
  near(w, (1.5 * 50 * 5) / 10000, 1e-12, 'w0 = 1.5qa/E at nu = 0.5');
  // The axis solution at z = 0 must agree with the closed form.
  near(axisResponse(0, 50, 5, 10000, 0.5).w, w, 1e-12, 'axis solution at the surface');
});

test('the flexible surface deflection agrees with the axis solution for any nu', () => {
  for (const nu of [0.2, 0.3, 0.35, 0.45]) {
    near(axisResponse(0, 80, 6, 25000, nu).w, surfaceDeflectionFlexible(80, 6, 25000, nu),
      1e-12, `nu = ${nu}`);
  }
});

test('Eq. 2.10 — a rigid plate deflects pi/4 as much as a flexible one', () => {
  const flex = surfaceDeflectionFlexible(50, 5, 10000, 0.45);
  const rigid = surfaceDeflectionRigid(50, 5, 10000, 0.45);
  near(rigid / flex, Math.PI / 4, 1e-12, 'rigid/flexible ratio');
  assert.ok(rigid < flex, 'the rigid plate deflects less at the same average pressure');
});

/* ──────────────────────── Off-axis integration ──────────────────────────── */

test('the off-axis integration reproduces the closed form on the axis', () => {
  for (const z of [2.5, 5, 10, 20]) {
    const exact = axisResponse(z, 50, 5, 10000, 0.4).sigZ;
    near(sigZAt(0, z, 50, 5), exact, 0.01, `sigma_z at r = 0, z = ${z}`);
  }
});

test('Example 2.1 — the second load contributes what Huang reads off the chart', () => {
  // The right-hand circle is 20 in away, so r/a = 4 at z/a = 2. Huang reads
  // 0.0076 q = 0.38 psi off Figure 2.2.
  const s = sigZAt(20, 10, 50, 5);
  near(s, 0.38, 0.25, 'sigma_z from the far load');
  assert.ok(s < 0.02 * 50, 'a load four radii away contributes very little');
});

test('Example 2.1 — the superposed vertical stress', () => {
  // Huang: 14.0 + 0.38 = 14.38 psi from the charts; KENLAYER gives 14.6.
  const total = sigZAt(0, 10, 50, 5) + sigZAt(20, 10, 50, 5);
  near(total, 14.6, 0.04, 'superposed sigma_z against the KENLAYER value');
});

test('stress falls off with radial distance at fixed depth', () => {
  const z = 5;
  const vals = [0, 2, 5, 10, 20].map(r => sigZAt(r, z, 50, 5));
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] < vals[i - 1], `sigma_z must decrease from r=${i - 1} to r=${i}`);
  }
});

/* ─────────────────────────────── Guards ─────────────────────────────────── */

test('invalid geometry returns null rather than NaN', () => {
  assert.equal(axisResponse(-1, 50, 5, 10000, 0.4), null);
  assert.equal(axisResponse(5, 50, 0, 10000, 0.4), null);
  assert.equal(axisResponse(5, 50, 5, 0, 0.4), null);
});

test('strains are consistent with Hooke law on the axis', () => {
  const { sigZ, sigR, epsZ, epsR } = axisResponse(7, 60, 5, 20000, 0.35);
  // On the axis sigma_r = sigma_t, so eps_z = [sz - 2 nu sr]/E exactly.
  near(epsZ, (sigZ - 2 * 0.35 * sigR) / 20000, 1e-12, 'vertical strain');
  near(epsR, ((1 - 0.35) * sigR - 0.35 * sigZ) / 20000, 1e-12, 'radial strain');
});
