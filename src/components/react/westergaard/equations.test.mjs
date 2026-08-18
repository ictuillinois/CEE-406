// Tests for the Westergaard slab responses. Run with:
//   node --experimental-strip-types --test src/components/react/westergaard/equations.test.mjs
//
// Every case is checked against the printed worked answers of Huang (2004)
// Examples 4.1 through 4.5, pp. 151-160. HW9 rests entirely on this module,
// so it is worth pinning to the book line by line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  radiusOfRelativeStiffness, equivalentRadius, equivalentSquareSide, dualEquivalentRadius,
  interiorStress, interiorDeflection,
  edgeStressCircle, edgeStressSemicircle, edgeDeflectionCircle, edgeDeflectionSemicircle,
  cornerStressOriginal, cornerDeflectionOriginal,
  cornerStressIoannides, cornerDeflectionIoannides,
  slabResponses, bradburyC, curlingStresses,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* The slab of Examples 4.2, 4.3 and 4.4: k = 100 pci, h = 10 in, a = 6 in,
 * P = 10,000 lb, with the book's standing E = 4×10⁶ psi and ν = 0.15. */
const SLAB = { E: 4e6, h: 10, nu: 0.15, k: 100, P: 10000, a: 6 };

/* ────────────────────────── Fundamental lengths ─────────────────────────── */

test('Eq. 4.10 — radius of relative stiffness', () => {
  const { E, h, nu, k } = SLAB;
  near(radiusOfRelativeStiffness(E, h, nu, k), 42.97, 0.001, 'ell');   // book: 42.97 in
});

test('Eq. 4.19b — equivalent radius of resisting section', () => {
  near(equivalentRadius(6, 10), 5.804, 0.001, 'b');                    // book: 5.804 in
});

test('Eq. 4.19a — a large contact area uses its own radius', () => {
  // a >= 1.724h, so b = a with no reduction.
  assert.equal(equivalentRadius(20, 10), 20);
});

/* ───────────────────── Example 4.3 — interior loading ───────────────────── */

test('Example 4.3 — interior stress and deflection', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const b = equivalentRadius(a, h);
  near(interiorStress(P, h, nu, ell, b), 143.7, 0.002, 'interior stress');       // book: 143.7 psi
  near(interiorDeflection(P, k, ell, a), 0.0067, 0.02, 'interior deflection');   // book: 0.0067 in
});

/* ─────────────────────── Example 4.4 — edge loading ─────────────────────── */

test('Example 4.4 — edge stress and deflection, circular contact', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  near(edgeStressCircle(P, E, h, nu, k, a, ell), 279.4, 0.002, 'edge stress');        // book: 279.4 psi
  near(edgeDeflectionCircle(P, E, h, nu, k, a, ell), 0.0207, 0.01, 'edge deflection'); // book: 0.0207 in
});

test('Example 4.4 — edge stress and deflection, SEMICIRCULAR contact', () => {
  // The case the tool previously omitted, and the governing one.
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  near(edgeStressSemicircle(P, E, h, nu, k, a, ell), 330.0, 0.002, 'semicircle stress');        // book: 330.0 psi
  near(edgeDeflectionSemicircle(P, E, h, nu, k, a, ell), 0.0222, 0.01, 'semicircle deflection'); // book: 0.0222 in
});

test('the semicircle is the more critical edge case, as Huang states', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const circ = edgeStressCircle(P, E, h, nu, k, a, ell);
  const semi = edgeStressSemicircle(P, E, h, nu, k, a, ell);
  assert.ok(semi > circ,
    `semicircle (${semi.toFixed(1)}) must exceed circle (${circ.toFixed(1)}) — its centroid sits closer to the edge`);
  near(semi / circ, 1.18, 0.02, 'ratio of the two published edge stresses');
});

/* ────────────────────── Example 4.2 — corner loading ────────────────────── */

test('Example 4.2 — corner by the ORIGINAL formulas (Eqs. 4.13, 4.14)', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  near(cornerStressOriginal(P, h, a, ell), 186.6, 0.002, 'corner stress');          // book: 186.6 psi
  near(cornerDeflectionOriginal(P, k, a, ell), 0.0502, 0.01, 'corner deflection');  // book: 0.0502 in
});

test('Example 4.2 — corner by the IOANNIDES formulas (Eqs. 4.15, 4.16)', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const c = equivalentSquareSide(a);
  near(c, 10.632, 0.001, 'equivalent square side');
  near(cornerStressIoannides(P, h, c, ell), 190.3, 0.002, 'corner stress');         // book: 190.3 psi
  near(cornerDeflectionIoannides(P, k, c, ell), 0.0560, 0.01, 'corner deflection'); // book: 0.0560 in
});

test('the two corner solutions disagree by the margins Huang quotes', () => {
  const { E, h, nu, k, P, a } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const c = equivalentSquareSide(a);
  const sOrig = cornerStressOriginal(P, h, a, ell);
  const sIoan = cornerStressIoannides(P, h, c, ell);
  const dOrig = cornerDeflectionOriginal(P, k, a, ell);
  const dIoan = cornerDeflectionIoannides(P, k, c, ell);
  // Book: "2% larger" in stress, "11% greater" in deflection.
  near(sIoan / sOrig - 1, 0.02, 0.30, 'stress disagreement');
  near(dIoan / dOrig - 1, 0.11, 0.20, 'deflection disagreement');
});

/* ──────────────────── Example 4.5 — dual tyre conversion ────────────────── */

test('Example 4.5 — duals converted to an equivalent circle', () => {
  const q = 10000 / (36 * Math.PI);
  near(q, 88.42, 0.001, 'contact pressure');
  const a = dualEquivalentRadius(5000, q, 14);
  near(a, 7.85, 0.002, 'equivalent radius');            // book: 7.85 in
  assert.ok(a > 6, 'the equivalent circle is larger than the single 6 in contact');
});

test('Example 4.5 — the larger contact area lowers every stress', () => {
  const { E, h, nu, k, P } = SLAB;
  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const q = P / (36 * Math.PI);
  const a = dualEquivalentRadius(P / 2, q, 14);
  const b = equivalentRadius(a, h);
  near(b, 7.34, 0.005, 'equivalent radius of resisting section');       // book: 7.34 in
  near(cornerStressOriginal(P, h, a, ell), 166.8, 0.005, 'corner');     // book: 166.8 psi
  near(interiorStress(P, h, nu, ell, b), 130.8, 0.005, 'interior');     // book: 130.8 psi
  near(edgeStressCircle(P, E, h, nu, k, a, ell), 244.2, 0.005, 'edge'); // book: 244.2 psi
});

/* ───────────────────────── Assembled responses ──────────────────────────── */

test('slabResponses reproduces every printed answer at once', () => {
  const r = slabResponses(SLAB.E, SLAB.h, SLAB.nu, SLAB.k, SLAB.P, SLAB.a);
  near(r.ell, 42.97, 0.001, 'ell');
  near(r.b, 5.804, 0.001, 'b');
  near(r.interior.stress, 143.7, 0.002, 'interior');
  near(r.edge.circle.stress, 279.4, 0.002, 'edge circle');
  near(r.edge.semicircle.stress, 330.0, 0.002, 'edge semicircle');
  near(r.corner.original.stress, 186.6, 0.002, 'corner original');
  near(r.corner.ioannides.stress, 190.3, 0.002, 'corner Ioannides');
});

test('edge loading governs, exactly as Huang concludes', () => {
  const r = slabResponses(SLAB.E, SLAB.h, SLAB.nu, SLAB.k, SLAB.P, SLAB.a);
  assert.equal(r.governing.case, 'Edge (semicircle)');
  // Book: "the maximum stress due to edge loading is greater than that due to
  // corner and interior loadings".
  assert.ok(r.edge.circle.stress > r.corner.ioannides.stress, 'edge beats corner');
  assert.ok(r.edge.circle.stress > r.interior.stress, 'edge beats interior');
  // And: corner deflection is the largest, interior the smallest.
  assert.ok(r.corner.ioannides.deflection > r.edge.circle.deflection, 'corner deflects most');
  assert.ok(r.edge.circle.deflection > r.interior.deflection, 'interior deflects least');
});

test('interior stress is 77% of corner and interior deflection 13% of it', () => {
  // The two ratios Huang states in the Example 4.3 discussion.
  const r = slabResponses(SLAB.E, SLAB.h, SLAB.nu, SLAB.k, SLAB.P, SLAB.a);
  near(r.interior.stress / r.corner.ioannides.stress, 0.77, 0.03, 'stress ratio');
  near(r.interior.deflection / r.corner.ioannides.deflection, 0.13, 0.10, 'deflection ratio');
});

test('invalid input returns null rather than NaN', () => {
  assert.equal(slabResponses(0, 10, 0.15, 100, 10000, 6), null);
  assert.equal(slabResponses(4e6, 10, 0.15, 100, 10000, 0), null);
});

/* ──────────────────── Example 4.1 — curling stresses ────────────────────── */

test('Example 4.1 — the slab geometry and its ratios', () => {
  const ell = radiusOfRelativeStiffness(4e6, 8, 0.15, 200);
  near(ell, 30.57, 0.001, 'ell');                 // book: 30.57 in
  near(300 / ell, 9.81, 0.002, 'Lx/ell');         // book: 9.81
  near(144 / ell, 4.71, 0.002, 'Ly/ell');         // book: 4.71
});

test('Example 4.1 — curling stresses in the interior and at the edge', () => {
  const ell = radiusOfRelativeStiffness(4e6, 8, 0.15, 200);
  const c = curlingStresses(4e6, 0.15, ell, 300, 144, 5e-6, 20);
  // The book reads Cx = 1.07 and Cy = 0.63 off Figure 4.4; the closed form is
  // finer-grained, so the stresses land ~1% above the printed 238 and 214 psi.
  near(c.Cx, 1.07, 0.02, 'Cx');
  near(c.Cy, 0.63, 0.02, 'Cy');
  near(c.interiorX, 238, 0.02, 'interior curling stress');
  near(c.edgeX, 214, 0.02, 'edge curling stress');
});

test('using the book chart values reproduces 238 psi exactly', () => {
  // Confirms the residual is chart-reading precision, not a formula error.
  const E = 4e6, nu = 0.15, alpha = 5e-6, dt = 20;
  const fromChart = ((E * alpha * dt) / 2) * ((1.07 + nu * 0.63) / (1 - nu * nu));
  near(fromChart, 238, 0.002, 'interior stress from the chart values');
});

test('Bradbury C hits both landmarks Huang quotes', () => {
  // "C = 1.0 for L = 6.7ℓ, reaching a maximum value of 1.084 for L = 8.5ℓ".
  near(bradburyC(6.7), 1.0, 0.01, 'C at L = 6.7 ell');
  let best = 0, at = 0;
  for (let r = 1; r < 20; r += 0.005) {
    const c = bradburyC(r);
    if (c > best) { best = c; at = r; }
  }
  near(best, 1.084, 0.01, 'maximum C');
  near(at, 8.5, 0.06, 'L/ell at the maximum');
  // And it returns to 1 for a very long slab.
  near(bradburyC(60), 1.0, 0.02, 'C for a very long slab');
});

test('a vanishingly short slab curls not at all', () => {
  assert.equal(bradburyC(0), 0);
  assert.ok(bradburyC(0.5) < 0.05, 'a slab much shorter than ell barely curls');
});

test('curling in the long direction exceeds the short direction', () => {
  const ell = radiusOfRelativeStiffness(4e6, 8, 0.15, 200);
  const c = curlingStresses(4e6, 0.15, ell, 300, 144, 5e-6, 20);
  assert.ok(c.interiorX > c.interiorY, 'the long dimension governs');
  assert.ok(c.edgeX > c.edgeY);
});

test('curling stress scales linearly with the temperature differential', () => {
  const ell = radiusOfRelativeStiffness(4e6, 8, 0.15, 200);
  const a = curlingStresses(4e6, 0.15, ell, 300, 144, 5e-6, 10);
  const b = curlingStresses(4e6, 0.15, ell, 300, 144, 5e-6, 20);
  near(b.interiorX / a.interiorX, 2, 1e-9, 'doubling dt doubles the stress');
});
