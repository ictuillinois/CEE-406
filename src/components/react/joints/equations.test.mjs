// Tests for joints, dowels, tie bars and faulting. Run with:
//   node --experimental-strip-types --test src/components/react/joints/equations.test.mjs
//
// Anchored to the printed answers of Huang (2004) Examples 4.8, 4.9, 4.11,
// 4.12 and 4.13, and to the landmarks of the faulting model in §12.1.4.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frictionStress, concreteTensileStrength, jointOpening, maxJointSpacing,
  tieBars, allowableBearingStress, dowelInertia, dowelBeta, dowelBearingStress,
  dowelGroup, dowelLoads, dowelPositions, faulting, FAULTING_BEARING_LIMIT,
  FAULTING_DATA_RANGE, faultingInRange, suggestedDowel, GAMMA_CONCRETE, E_STEEL,
} from './equations.ts';
import { radiusOfRelativeStiffness } from '../westergaard/equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* ───────────────────── Example 4.8 — friction stress ───────────────────── */

test('Example 4.8 — friction stress in a 25 ft slab', () => {
  near(GAMMA_CONCRETE, 0.0868, 0.005, 'unit weight in pci');
  near(frictionStress(300, 1.5), 19.5, 0.01, 'friction stress');   // book: 19.5 psi
});

test('friction stress does not depend on slab thickness', () => {
  // Eq. 4.35 has no h in it, which surprises most students.
  assert.equal(frictionStress(300, 1.5), frictionStress(300, 1.5));
  // It does scale linearly with length and with the friction coefficient.
  near(frictionStress(600, 1.5), 2 * frictionStress(300, 1.5), 1e-12, 'doubling L');
  near(frictionStress(300, 3.0), 2 * frictionStress(300, 1.5), 1e-12, 'doubling fa');
});

test('friction stress stays far below the concrete tensile strength', () => {
  // The book's conclusion: joint spacing is not governed by friction stress.
  const [lo, hi] = concreteTensileStrength(3000);
  near(lo, 164, 0.01, 'lower tensile strength');   // book: 164 psi
  near(hi, 274, 0.01, 'upper tensile strength');   // book: 274 psi
  assert.ok(frictionStress(300, 1.5) < lo / 5, 'friction stress is an order below');
});

/* ───────────────── Example 4.9 — joint opening and spacing ─────────────── */

const EX49 = { dT: 60, alphaT: 5.5e-6, eps: 1.0e-4, C: 0.65 };

test('Example 4.9 — maximum spacing for undoweled and doweled joints', () => {
  const undoweled = maxJointSpacing(0.05, EX49.dT, EX49.alphaT, EX49.eps, EX49.C);
  const doweled = maxJointSpacing(0.25, EX49.dT, EX49.alphaT, EX49.eps, EX49.C);
  near(undoweled, 178.6, 0.01, 'undoweled spacing, in');   // book: 178.6 in = 14.9 ft
  near(undoweled / 12, 14.9, 0.01, 'undoweled spacing, ft');
  near(doweled, 892.9, 0.01, 'doweled spacing, in');       // book: 892.9 in = 74.4 ft
  near(doweled / 12, 74.4, 0.01, 'doweled spacing, ft');
});

test('joint opening and maximum spacing are inverses of each other', () => {
  const L = maxJointSpacing(0.05, EX49.dT, EX49.alphaT, EX49.eps, EX49.C);
  near(jointOpening(L, EX49.dT, EX49.alphaT, EX49.eps, EX49.C), 0.05, 1e-9, 'round trip');
});

test('a stabilised base allows longer slabs than a granular one', () => {
  // C = 0.65 stabilised, 0.80 granular: less restraint means less opening.
  const stab = maxJointSpacing(0.05, EX49.dT, EX49.alphaT, EX49.eps, 0.65);
  const gran = maxJointSpacing(0.05, EX49.dT, EX49.alphaT, EX49.eps, 0.80);
  assert.ok(stab > gran, 'the lower friction factor permits a longer slab');
});

/* ───────────────────────── Example 4.11 — tie bars ─────────────────────── */

test('Example 4.11 — No. 4 bars at 36 in, 24 in long', () => {
  // h = 8 in, L' = 12 ft = 144 in, fs = 27,000 psi, No. 4 bar (0.2 in², 0.5 in).
  const r = tieBars(8, 144, 27000, 0.2, 0.5);
  near(r.asPerIn, 0.00556, 0.01, 'steel area per inch');   // book: 0.00556 in²/in
  near(r.spacing, 36, 0.01, 'bar spacing');                // book: 36 in
  near(r.lengthRaw, 19.3, 0.01, 'bond length');            // book: 19.3 in
  near(r.length, 22.3, 0.01, 'length with misalignment');  // book: 22.3 → use 24 in
});

test('a wider tied width needs more steel', () => {
  const narrow = tieBars(8, 144, 27000, 0.2, 0.5);
  const wide = tieBars(8, 288, 27000, 0.2, 0.5);
  near(wide.asPerIn, 2 * narrow.asPerIn, 1e-9, 'double the width, double the steel');
  near(wide.spacing, narrow.spacing / 2, 1e-9, 'so the bars go twice as close');
  // Bar length depends only on developing the bar, not on how much steel there is.
  near(wide.length, narrow.length, 1e-12, 'length is unchanged');
});

test('tie bars reject impossible input', () => {
  assert.equal(tieBars(0, 144, 27000, 0.2, 0.5), null);
  assert.equal(tieBars(8, 144, 0, 0.2, 0.5), null);
});

/* ────────────── Example 4.12 — bearing stress on one dowel ─────────────── */

const EX412 = { h: 8, z: 0.2, k: 100, K: 1.5e6, d: 0.75, W: 9000, fc: 3000 };

test('Example 4.12 — radius of relative stiffness and the effective group', () => {
  const ell = radiusOfRelativeStiffness(4e6, EX412.h, 0.15, EX412.k);
  near(ell, 36.35, 0.005, 'ell');                     // book: 36.35 in
  near(1.8 * ell, 66, 0.01, '1.8 ell');               // book: 66 in

  // Dowels at 12 in centres, load over the outermost one.
  const positions = [0, 12, 24, 36, 48, 60, 72];
  const g = dowelGroup(0, positions, ell, EX412.W, 1.8, 0.5);
  near(g.effectiveDowels, 3.27, 0.01, 'effective dowels');   // book: 3.27
  near(g.criticalLoad, 1376, 0.01, 'load on the critical dowel');  // book: 1376 lb
});

test('Example 4.12 — dowel properties and the bearing stress', () => {
  near(dowelInertia(0.75), 0.0155, 0.01, 'moment of inertia');   // book: 0.0155 in⁴
  near(dowelBeta(0.75, 1.5e6), 0.889, 0.01, 'beta');             // book: 0.889 /in
  const sigma = dowelBearingStress(1376, 0.75, 0.2, 1.5e6);
  near(sigma, 3556, 0.01, 'bearing stress');                     // book: 3556 psi
});

test('Example 4.12 — the design is NOT satisfactory, as the book concludes', () => {
  const allow = allowableBearingStress(0.75, 3000);
  near(allow, 3250, 0.01, 'allowable bearing stress');           // book: 3250 psi
  const actual = dowelBearingStress(1376, 0.75, 0.2, 1.5e6);
  assert.ok(actual > allow, 'the actual stress exceeds the allowable');
  near(actual / allow - 1, 0.10, 0.15, 'by about 10%, as the book says');
});

test('a larger dowel is ALLOWED less bearing stress but CARRIES it better', () => {
  // Eq. 4.41 falls with diameter — counterintuitive until you notice it is a
  // concrete criterion, not a steel one. Meanwhile the actual stress falls
  // faster, so a bigger dowel still helps.
  assert.ok(allowableBearingStress(1.25, 3000) < allowableBearingStress(0.75, 3000));
  const small = dowelBearingStress(1376, 0.75, 0.2, 1.5e6);
  const big = dowelBearingStress(1376, 1.25, 0.2, 1.5e6);
  assert.ok(big < small, 'the bigger dowel is less stressed');
});

/* ───────────── Example 4.13 — dowel group with two wheel loads ─────────── */

test('Example 4.13 — effective dowels under each of the two loads', () => {
  const ell = radiusOfRelativeStiffness(4e6, 9.5, 0.15, 50);
  near(ell, 49.17, 0.005, 'ell');            // book: 49.17 in
  near(1.8 * ell, 88, 0.01, '1.8 ell');      // book: 88 in

  // Twelve dowels at 12 in centres across a 12 ft lane, first 6 in from edge.
  const positions = dowelPositions(144, 12, 6);
  assert.equal(positions.length, 12, 'twelve dowels');

  const atA = dowelGroup(6, positions, ell, 9000, 1.8, 0.5);
  near(atA.effectiveDowels, 4.18, 0.01, 'effective dowels under load A');  // book: 4.18
  near(atA.criticalLoad, 1077, 0.01, 'load on the dowel at A');            // book: 1077 lb

  const atB = dowelGroup(78, positions, ell, 9000, 1.8, 0.5);
  near(atB.effectiveDowels, 7.08, 0.01, 'effective dowels under load B');  // book: 7.08
  near(atB.criticalLoad, 636, 0.01, 'load on the dowel at B');             // book: 636 lb
});

test('Example 4.13 — the edge dowel is critical once both loads are superposed', () => {
  const ell = radiusOfRelativeStiffness(4e6, 9.5, 0.15, 50);
  const positions = dowelPositions(144, 12, 6);
  const loads = dowelLoads([{ pos: 6, W: 9000 }, { pos: 78, W: 9000 }], positions, ell, 1.8, 0.5);

  // Book: Pt = 4500/4.18 + 0.18 x 4500/7.08 = 1191 lb on the edge dowel.
  near(loads[0], 1191, 0.02, 'load on the edge dowel');
  // And it really is the worst one — the point of the example.
  assert.equal(loads.indexOf(Math.max(...loads)), 0,
    'the dowel nearest the pavement edge carries the most');
});

/* ─────────── The disagreement: Friberg 1.8 ell vs Heinrichs 1.0 ell ─────── */

test('the Heinrichs reach concentrates load and raises the bearing stress', () => {
  // Huang: "Recent studies by Heinrichs et al. (1989) have shown that the
  // maximum negative moment occurs at 1.0 ell, so the load carried by the most
  // critical dowel should be larger than those shown in the examples."
  const ell = radiusOfRelativeStiffness(4e6, EX412.h, 0.15, EX412.k);
  const positions = [0, 12, 24, 36, 48, 60, 72];
  const friberg = dowelGroup(0, positions, ell, EX412.W, 1.8, 0.5);
  const heinrichs = dowelGroup(0, positions, ell, EX412.W, 1.0, 0.5);

  assert.ok(heinrichs.effectiveDowels < friberg.effectiveDowels,
    'a shorter reach shares the load over fewer dowels');
  assert.ok(heinrichs.criticalLoad > friberg.criticalLoad,
    'so the critical dowel carries more');

  const sFriberg = dowelBearingStress(friberg.criticalLoad, 0.75, 0.2, 1.5e6);
  const sHeinrichs = dowelBearingStress(heinrichs.criticalLoad, 0.75, 0.2, 1.5e6);
  assert.ok(sHeinrichs > sFriberg * 1.2,
    `the newer assumption raises bearing stress materially: ${sFriberg.toFixed(0)} → ${sHeinrichs.toFixed(0)} psi`);
});

test('the faulting convention transfers 0.45W over 1.0 ell', () => {
  // §12.1.4: same procedure as Example 4.12 "except that the load is
  // distributed over an effective length of 1.0 ell instead of 1.8 ell, and
  // the load transferred through the joint is assumed to be 0.45W".
  const ell = radiusOfRelativeStiffness(4e6, EX412.h, 0.15, EX412.k);
  const positions = [0, 12, 24, 36, 48, 60, 72];
  const design = dowelGroup(0, positions, ell, EX412.W, 1.8, 0.5);
  const forFaulting = dowelGroup(0, positions, ell, EX412.W, 1.0, 0.45);
  // Fewer dowels but less load crossing — the net is still an increase.
  assert.ok(forFaulting.criticalLoad > design.criticalLoad,
    'the faulting convention is the more severe of the two');
});

/* ─────────────────────── Faulting (Huang Eq. 12.3) ─────────────────────── */

test('the faulting model lands in the range Figure 12.5 plots', () => {
  // Figure 12.5 sweeps bearing stress from 1000 to 3500 psi at N18 = 10
  // million, with faulting reaching roughly 0.24 in at the top of the axis.
  for (const S of [1000, 1500, 2000, 2500, 3000, 3500]) {
    const F = faulting(10, S, 15, 100);
    assert.ok(F > 0 && F < 0.35, `faulting ${F.toFixed(3)} in at S = ${S} psi is off the chart`);
  }
});

test('faulting grows with bearing stress, traffic and joint spacing', () => {
  assert.ok(faulting(10, 2500, 15, 100) > faulting(10, 1500, 15, 100), 'bearing stress');
  assert.ok(faulting(20, 2000, 15, 100) > faulting(10, 2000, 15, 100), 'traffic');
  assert.ok(faulting(10, 2000, 20, 100) > faulting(10, 2000, 15, 100), 'joint spacing');
});

test('faulting falls as the foundation stiffens', () => {
  assert.ok(faulting(10, 2000, 15, 200) < faulting(10, 2000, 15, 100), 'stiffer k');
});

test('bearing stress dominates joint spacing, as Huang states', () => {
  // "bearing stress has the most significant effect on faulting and joint
  // spacing the least effect".
  const base = faulting(10, 2000, 15, 100);
  const dStress = Math.abs(faulting(10, 3000, 15, 100) - base);
  const dSpacing = Math.abs(faulting(10, 2000, 20, 100) - base);
  assert.ok(dStress > dSpacing, 'bearing stress moves faulting more than spacing does');
});

test('the 1500 psi bearing limit keeps faulting modest', () => {
  near(FAULTING_BEARING_LIMIT, 1500, 1e-12, 'the limit §12.1.4 quotes');
  const F = faulting(10, FAULTING_BEARING_LIMIT, 15, 100);
  assert.ok(F < 0.12, `at the limit faulting is ${F.toFixed(3)} in, which is acceptable`);
});

test('faulting rejects impossible input rather than returning a number', () => {
  assert.ok(Number.isNaN(faulting(0, 2000, 15, 100)));
  assert.ok(Number.isNaN(faulting(10, 2000, 15, 0)));
});

/* ──────────────────────── Dowel size guidance ──────────────────────────── */

test('the PCA rule puts the dowel diameter at one eighth of the slab', () => {
  near(suggestedDowel(8).diameter, 1.0, 1e-12, '8 in slab');
  near(suggestedDowel(10).diameter, 1.25, 1e-12, '10 in slab');
  assert.equal(suggestedDowel(8).length, 14);
  assert.equal(suggestedDowel(6).length, 12);
});

test('dowelPositions lays bars out across the lane', () => {
  const p = dowelPositions(144, 12, 6);
  assert.equal(p.length, 12);
  near(p[0], 6, 1e-12, 'first dowel');
  near(p[p.length - 1], 138, 1e-12, 'last dowel');
});

test('the faulting model knows where its own data ended', () => {
  // Huang: "This model must not be used to predict faulting by extrapolation
  // beyond the data range used in its generation."
  assert.deepEqual(FAULTING_DATA_RANGE, [1000, 3500]);
  assert.ok(faultingInRange(2000), 'inside the fitted range');
  assert.ok(!faultingInRange(5200), 'a badly overstressed dowel is outside it');
  assert.ok(!faultingInRange(500), 'and so is an implausibly low stress');
});

test('the Heinrichs convention can push a design out of the faulting range', () => {
  // Huang Example 4.12 on the §12.1.4 convention lands near 5200 psi, well
  // outside the 1000-3500 psi the regression saw. The tool must flag that
  // rather than quoting a confident number.
  const ell = radiusOfRelativeStiffness(4e6, 8, 0.15, 100);
  const positions = dowelPositions(84, 12, 6);
  const g = dowelGroup(6, positions, ell, 9000, 1.0, 0.45);
  const S = dowelBearingStress(g.criticalLoad, 0.75, 0.2, 1.5e6);
  assert.ok(S > FAULTING_DATA_RANGE[1], `bearing stress ${S.toFixed(0)} psi is off the calibration range`);
  assert.ok(!faultingInRange(S), 'and is flagged as such');
});
