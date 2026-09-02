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
  planFrame,
  SAFE_RANGE,
  SLIP_RANGE,
  TRAINED_ENVELOPE,
  trainedBox,
  niceCeil,
  shearLimit,
  SHEAR_FLOOR,
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

/* ── The plan view's frame ────────────────────────────────────────────────
 * The card solves its canvas height from the aspect ratio of these two
 * numbers, so anything that moves them moves the figure under the reader.
 * The frame was once sized to the current idealization and the canvas
 * breathed with the load slider — 39 distinct heights across the DTA box,
 * 383px to 421px, all of it motion that has nothing to do with the field.
 * planFrame takes no load and no pressure, which is the guarantee; these
 * tests are here for the other half of it, that freezing the frame did not
 * quietly start clipping an outline.
 */

// The two shipped solution windows, from public/tools/contact-stress/manifest.json.
const WINDOWS = {
  DTA: { w: 161, h: 112, dx: 1.9937888198757765, dy: 2 },
  WBT: { w: 161, h: 196, dx: 1.9937888198757765, dy: 1.9948979591836735 },
};

test('the plan-view frame holds still across the whole admissible box', () => {
  for (const [tire, win] of Object.entries(WINDOWS)) {
    const f = planFrame(tire, win.w, win.h, win.dx, win.dy);
    const r = SAFE_RANGE[tire];
    // Sweep far finer than any slider step. Nothing here may move the frame:
    // planFrame cannot see the load, and this asserts nobody reintroduced it.
    for (let i = 0; i <= 60; i++) {
      const load = r.load[0] + ((r.load[1] - r.load[0]) * i) / 60;
      for (let j = 0; j <= 60; j++) {
        const p = r.pressure[0] + ((r.pressure[1] - r.pressure[0]) * j) / 60;
        idealizedContact(load, p);
        const g = planFrame(tire, win.w, win.h, win.dx, win.dy);
        assert.equal(g.halfX, f.halfX, `${tire} halfX moved at ${load} N, ${p} MPa`);
        assert.equal(g.halfY, f.halfY, `${tire} halfY moved at ${load} N, ${p} MPa`);
      }
    }
  }
});

test('every outline the sliders can reach fits the frame horizontally', () => {
  for (const [tire, win] of Object.entries(WINDOWS)) {
    const f = planFrame(tire, win.w, win.h, win.dx, win.dy);
    const r = SAFE_RANGE[tire];
    for (let i = 0; i <= 60; i++) {
      const load = r.load[0] + ((r.load[1] - r.load[0]) * i) / 60;
      for (let j = 0; j <= 60; j++) {
        const p = r.pressure[0] + ((r.pressure[1] - r.pressure[0]) * j) / 60;
        const d = idealizedContact(load, p);
        const where = `${tire} at ${Math.round(load)} N, ${p.toFixed(3)} MPa`;
        assert.ok(d.length / 2 <= f.halfX, `Huang outline clips: ${where}`);
        assert.ok(d.rectLength / 2 <= f.halfX, `PCA rectangle clips: ${where}`);
        assert.ok(d.circleRadius <= f.halfX, `equal-area circle clips in x: ${where}`);
        assert.ok(d.width / 2 <= f.halfY, `Huang and PCA clip in y: ${where}`);
      }
    }
  }
});

test('the frame also holds the solution window it is drawn over', () => {
  for (const [tire, win] of Object.entries(WINDOWS)) {
    const f = planFrame(tire, win.w, win.h, win.dx, win.dy);
    assert.ok(f.halfX >= (win.w * win.dx) / 2, `${tire} crops its own field in x`);
    assert.ok(f.halfY >= (win.h * win.dy) / 2, `${tire} crops its own field in y`);
  }
});

/* Recorded, not asserted as desirable: on DTA the equal-area circle is TALLER
   than the frame — r reaches 146 mm against a half-height of 119 — so its cap
   runs off the top and bottom, as it did before the frame was frozen. Framing
   to the circle would cost about a fifth of the figure's height to show two
   arcs of an outline whose radius the legend already prints. If that trade is
   ever reversed, planFrame's halfY is the one line to change. */
test('the DTA circle is known to overrun the frame vertically', () => {
  const win = WINDOWS.DTA;
  const f = planFrame('DTA', win.w, win.h, win.dx, win.dy);
  const r = SAFE_RANGE.DTA;
  const widest = idealizedContact(r.load[1], r.pressure[0]);
  assert.ok(widest.circleRadius > f.halfY, 'if this now fits, delete this test');
  // The wide-base frame is tall enough that it never does.
  const wb = WINDOWS.WBT;
  const fw = planFrame('WBT', wb.w, wb.h, wb.dx, wb.dy);
  const wbWidest = idealizedContact(SAFE_RANGE.WBT.load[1], SAFE_RANGE.WBT.pressure[0]);
  assert.ok(wbWidest.circleRadius <= fw.halfY, 'the wide-base circle should fit');
});


/* ── What the controls are allowed to reach ───────────────────────────
 * The training domain is not a box: only free rolling at 8 km/h was simulated
 * over the whole of the rectangle the checkpoint's normalization table
 * reports. Every other block is 18-50 kN x 0.5-0.9 MPa. The sliders span the
 * intersection, so a student cannot press "Braking" and land at 1.0 MPa,
 * where the FE database has not one case at any load or speed.
 * predictor.test.mjs owns the other half of this, against the artifact.
 */

test('the sliders stay inside every block of the training envelope', () => {
  for (const tire of ['DTA', 'WBT']) {
    const box = trainedBox(tire);
    const safe = SAFE_RANGE[tire];
    assert.ok(safe.load[0] >= box.load[0],
      `${tire}: the load slider starts at ${safe.load[0]} N, below the ${box.load[0]} N every block covers`);
    assert.ok(safe.load[1] <= box.load[1], `${tire}: the load slider runs past ${box.load[1]} N`);
    assert.ok(safe.pressure[0] >= box.pressure[0], `${tire}: the pressure slider starts below ${box.pressure[0]} MPa`);
    assert.ok(safe.pressure[1] <= box.pressure[1],
      `${tire}: the pressure slider runs to ${safe.pressure[1]} MPa, past the ${box.pressure[1]} MPa every block covers`);
    // And the box has to be checked block by block, not just against the
    // intersection helper — that is the thing that was wrong before.
    for (const [key, env] of Object.entries(TRAINED_ENVELOPE[tire])) {
      assert.ok(safe.load[0] >= env.load[0] && safe.load[1] <= env.load[1],
        `${tire} ${key}: load slider leaves ${JSON.stringify(env.load)}`);
      assert.ok(safe.pressure[0] >= env.pressure[0] && safe.pressure[1] <= env.pressure[1],
        `${tire} ${key}: pressure slider leaves ${JSON.stringify(env.pressure)}`);
    }
  }
});

test('the DTA envelope is the one recorded from the shipped feature matrix', () => {
  // Lang et al. (2026) Table 1, cross-checked case by case against the feature
  // matrix beside the checkpoint. If a re-bake ever changes these, the sliders
  // have to be re-derived, not the table edited to match them.
  const e = TRAINED_ENVELOPE.DTA;
  assert.deepEqual(Object.keys(e).sort(),
    ['5mph|Acc', '5mph|Brake', '5mph|FR', '70mph|Acc', '70mph|Brake', '70mph|FR'].sort());
  // Free rolling at 8 km/h is the ONLY block that spans the full rectangle.
  assert.deepEqual(e['5mph|FR'].pressure, [0.5, 1.0]);
  for (const [key, env] of Object.entries(e)) {
    if (key === '5mph|FR') continue;
    assert.deepEqual(env.pressure, [0.5, 0.9], `${key} should stop at 0.9 MPa`);
    assert.ok(env.load[1] === 50000, `${key} should stop at 50 kN`);
  }
  // Which is why the intersection is much smaller than the union.
  const box = trainedBox('DTA');
  assert.deepEqual(box.pressure, [0.5, 0.9]);
  assert.deepEqual(box.load, [18000, 50000]);
  // Free-rolling blocks must not drag the slip ceiling to zero: it is the
  // smallest ceiling among the blocks that carry slip at all.
  assert.equal(box.slip[1], 0.99);
  assert.deepEqual(SLIP_RANGE, [0, box.slip[1]]);
  // The wide-base branch is one free-rolling block, so its box is that block.
  assert.deepEqual(trainedBox('WBT').pressure, [0.4, 1.0]);
  assert.equal(trainedBox('WBT').slip[1], 0);
});

/* ── The adaptive shear scale ────────────────────────────────────
 * The 3-D shear windows are the one thing in this tool that scales itself to
 * its own data. What keeps that honest is that the limit is symmetric (so
 * neither sign is drawn louder) and snapped to a round number (so it holds
 * still through a slider drag instead of creeping every frame).
 */

test('niceCeil rounds up to a round number, and never down', () => {
  // Every stop, and a value just above every stop — the widest gap in the
  // ladder is what this bounds, so it has to be probed at every gap.
  const probes = [0.0031, 0.011, 0.035, 0.117, 0.148, 0.25, 0.464, 0.7, 1.13, 9.5, 47];
  for (let d = -3; d <= 1; d++) {
    for (const m of [1, 1.2, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9]) {
      probes.push(m * 10 ** d * 1.0000001);
    }
  }
  for (const v of probes) {
    const n = niceCeil(v);
    assert.ok(n >= v, `${v} rounded DOWN to ${n}`);
    assert.ok(n <= v * 1.250001, `${v} rounded up to ${n} — more than 25% of headroom`);
  }
  // A value that already is a stop must land on itself, not jump a step. The
  // stops are round decimals and the fields they measure are round decimals,
  // so they coincide constantly; binary floating point makes 0.3 / 0.1 come
  // out as 2.9999999999999996, and a strict compare walks straight past it.
  for (const v of [0.1, 0.12, 0.15, 0.175, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 0.02]) {
    close(niceCeil(v), v, 1e-12, `niceCeil(${v}) should be itself`);
  }
  // Degenerate inputs cannot produce a degenerate axis.
  assert.equal(niceCeil(0), 0);
  assert.equal(niceCeil(-1), 0);
  assert.equal(niceCeil(NaN), 0);
});

test('shearLimit is symmetric, covers the field, and has a floor', () => {
  // Symmetric about zero: the sign of the extreme cannot change the limit.
  assert.equal(shearLimit(-0.464, 0.013), shearLimit(-0.013, 0.464));
  // It must cover the field it is given, or Plotly clamps and says nothing.
  for (const [lo, hi] of [[-0.148, 0.093], [-0.013, 0.464], [-0.459, 0.012], [-0.126, 0.117]]) {
    const lim = shearLimit(lo, hi);
    assert.ok(lim >= Math.abs(lo) && lim >= hi, `${lo}..${hi} runs off ±${lim}`);
  }
  // An all-but-flat field opens onto the floor, not onto nothing.
  assert.equal(shearLimit(0, 0), SHEAR_FLOOR);
  assert.equal(shearLimit(-1e-9, 1e-9), SHEAR_FLOOR);
  assert.ok(shearLimit(-0.03, 0.035) > SHEAR_FLOOR, 'the floor should not bind on a real field');
});
