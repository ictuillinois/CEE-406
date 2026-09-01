/* The classical footprint idealizations, against Huang's printed relations.
 *
 * Huang, Pavement Analysis and Design (2nd ed.), §1.3:
 *   Figure 1.13   why contact pressure is not the inflation pressure
 *   Figure 1.14a  rectangle + two semicircles, length L, width 0.6L
 *   Eq. 1.1       Ac = pi(0.3L)^2 + (0.4L)(0.6L) = 0.5227 L^2, L = sqrt(Ac/0.5227)
 *   Figure 1.14b  PCA (1984) equivalent rectangle 0.8712L x 0.6L, same area
 *
 * Run:  node --experimental-strip-types --test src/components/react/contactstress/equations.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUANG_SHAPE_FACTOR,
  idealizedContact,
  huangOutline,
  circleOutline,
  rectOutline,
  fieldMetrics,
  compare,
  decimate,
  peakRow,
  rowProfile,
  colProfile,
  CONTACT_THRESHOLD,
  forceOut,
  pressureOut,
  areaOut,
  N_PER_LBF,
  PSI_PER_MPA,
} from './equations.ts';

const close = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

/** Signed area of a closed polyline. */
function shoelace(x, y) {
  let s = 0;
  for (let i = 0; i < x.length - 1; i++) s += x[i] * y[i + 1] - x[i + 1] * y[i];
  return Math.abs(s) / 2;
}

test('Eq. 1.1 shape factor is exactly pi(0.3)^2 + (0.4)(0.6)', () => {
  const derived = Math.PI * 0.3 * 0.3 + 0.4 * 0.6;
  close(derived, HUANG_SHAPE_FACTOR, 5e-5, 'shape factor');
});

test('Ac = P/p, and L inverts Eq. 1.1', () => {
  // 42 kN at 0.69 MPa — the case of Figure 8 in Lang et al. (2026).
  const id = idealizedContact(42000, 0.69);
  close(id.area, 42000 / 0.69, 1e-9, 'Ac');
  close(HUANG_SHAPE_FACTOR * id.length ** 2, id.area, 1e-6, 'Ac = 0.5227 L^2');
  close(id.width, 0.6 * id.length, 1e-12, 'width = 0.6L');
  close(id.rectLength, 0.8712 * id.length, 1e-12, 'PCA length');
  // The PCA rectangle has the same area as the outline it replaces.
  close(id.rectLength * id.width, id.area, id.area * 1e-4, 'PCA rectangle area');
  // The equal-area circle used by layered theory.
  close(Math.PI * id.circleRadius ** 2, id.area, 1e-6, 'circle area');
});

test('the drawn outlines enclose the areas they claim', () => {
  const id = idealizedContact(31000, 0.8);
  close(shoelace(...Object.values(huangOutline(id, 720))), id.area, id.area * 2e-4, 'Huang outline');
  const c = circleOutline(id.circleRadius, 2048);
  close(shoelace(c.x, c.y), id.area, id.area * 2e-4, 'circle outline');
  const r = rectOutline(id.rectLength, id.width);
  close(shoelace(r.x, r.y), id.area, id.area * 1e-4, 'PCA rectangle outline');
});

test('a 10 in circular imprint at 100 psi is a 7854 lb wheel — the classic check', () => {
  // Boussinesq problems in Huang Ch. 2 are posed this way round: a = 5 in,
  // p = 100 psi, so P = p * pi * a^2 = 7854 lb.
  const P = 100 * Math.PI * 25; // lb
  const id = idealizedContact(P * N_PER_LBF, 100 / PSI_PER_MPA);
  close(id.circleRadius / 25.4, 5, 1e-6, 'radius back to 5 in');
  close(forceOut(P * N_PER_LBF, 'US') * 1000, P, 1e-6, 'force round trip');
  close(pressureOut(100 / PSI_PER_MPA, 'US'), 100, 1e-9, 'pressure round trip');
  close(areaOut(id.area, 'US'), Math.PI * 25, 1e-6, 'area round trip');
});

test('a uniform patch measures back to the pressure that made it', () => {
  // 60 x 40 cells of 2 mm x 2 mm at exactly 0.8 MPa, in a 100 x 80 field.
  const h = 80;
  const w = 100;
  const f = new Float32Array(h * w);
  for (let r = 20; r < 60; r++) for (let c = 20; c < 80; c++) f[r * w + c] = 0.8;
  const m = fieldMetrics(f, h, w, 2, 2, undefined);
  const area = 40 * 60 * 4;
  close(m.contactArea, area, 1e-9, 'contact area');
  close(m.resultant, 0.8 * area, 0.8 * area * 1e-6, 'resultant');
  close(m.meanContactPressure, 0.8, 1e-6, 'mean contact pressure');
  close(m.extentTransverse, 80, 1e-9, 'transverse extent');
  close(m.extentLongitudinal, 120, 1e-9, 'longitudinal extent');

  // ...and the comparison against the idealization is then exactly unity.
  const id = idealizedContact(m.resultant, 0.8);
  const cmp = compare(m, id, m.resultant);
  close(cmp.meanOverInflation, 1, 1e-6, 'mean / inflation');
  close(cmp.areaOverIdeal, 1, 1e-6, 'area / ideal');
  close(cmp.equilibrium, 1, 1e-9, 'equilibrium closure');
  close(cmp.tension, 0, 1e-12, 'tension index');
});

test('the contact gate ignores what is below the threshold', () => {
  const h = 10;
  const w = 10;
  const f = new Float32Array(h * w).fill(CONTACT_THRESHOLD / 2);
  f[55] = 1;
  const m = fieldMetrics(f, h, w, 1, 1);
  close(m.contactArea, 1, 1e-12, 'only the one pixel counts');
  assert.deepEqual(m.bounds, [5, 5, 5, 5]);
});

test('a mask makes the shear components share the vertical patch', () => {
  const h = 6;
  const w = 6;
  const vert = new Float32Array(h * w);
  const shear = new Float32Array(h * w).fill(0.5);
  for (let i = 0; i < 4; i++) vert[i] = 1;
  const m = fieldMetrics(shear, h, w, 1, 1, vert);
  close(m.contactArea, 4, 1e-12, 'patch comes from the vertical field');
  close(m.peak, 0.5, 1e-12, 'peak still measured on the shear field');
});

test('decimation preserves the mean of each block', () => {
  const h = 8;
  const w = 8;
  const f = new Float32Array(h * w);
  for (let i = 0; i < f.length; i++) f[i] = i;
  const d = decimate(f, h, w, 4, 4);
  assert.equal(d.h, 4);
  assert.equal(d.w, 4);
  close(d.data[0][0], (0 + 1 + 8 + 9) / 4, 1e-9, 'first block mean');
  const total = d.data.flat().reduce((a, b) => a + b, 0) * d.fy * d.fx;
  close(total, f.reduce((a, b) => a + b, 0), 1e-6, 'sum preserved');
});

test('profiles and the peak row read the field they are given', () => {
  const h = 5;
  const w = 4;
  const f = new Float32Array(h * w);
  f[2 * w + 3] = 9;
  assert.equal(peakRow(f, h, w), 2);
  assert.deepEqual([...rowProfile(f, h, w, 2)], [0, 0, 0, 9]);
  assert.deepEqual([...colProfile(f, h, w, 3)], [0, 0, 9, 0, 0]);
});

test('a heavier tire at the same pressure needs proportionally more area', () => {
  const a = idealizedContact(20000, 0.7);
  const b = idealizedContact(40000, 0.7);
  close(b.area / a.area, 2, 1e-12, 'area scales with load');
  close(b.length / a.length, Math.SQRT2, 1e-12, 'length scales with sqrt(load)');
  // ...and a higher pressure shrinks it, which is the whole point of Fig. 1.13.
  const c = idealizedContact(20000, 1.0);
  close(c.area / a.area, 0.7, 1e-12, 'area scales inversely with pressure');
});
