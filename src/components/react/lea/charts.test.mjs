// The chart catalog, checked against the pages it redraws. Run:
//   node --experimental-strip-types --test src/components/react/lea/charts.test.mjs
//
// Two things are being asserted. First, that every anchor — a read Huang
// actually prints in a worked example — lands where he says it does; if one
// moves, a redrawn chart has stopped being the book's chart. Second, that
// every curve the catalog claims to draw is actually drawable: on the axis,
// the right way up, and inverting back to the parameter it came from.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARTS, SECTIONS, chartById, sampleCurve, invertFamily, nearestCurve,
} from './charts.ts';

test('the catalog covers every empirical chart in Chapter 2', () => {
  const figures = CHARTS.map(c => c.figure);
  for (const f of [
    'Figure 2.2', 'Figure 2.3', 'Figure 2.4', 'Figure 2.5', 'Figure 2.6',
    'Figure 2.14', 'Figure 2.15', 'Figure 2.17', 'Figure 2.19', 'Figure 2.21',
    'Figures 2.23 and 2.25–2.27', 'Figure 2.31',
  ]) {
    assert.ok(figures.includes(f), `${f} is missing from the catalog`);
  }
  // Ids are the routing key and must be unique.
  assert.equal(new Set(CHARTS.map(c => c.id)).size, CHARTS.length, 'duplicate chart id');
  for (const c of CHARTS) {
    assert.ok(SECTIONS.includes(c.section), `${c.id} has an unknown section`);
    assert.ok(c.purpose.length > 20, `${c.id} needs a purpose`);
    assert.ok(c.equation.includes('='), `${c.id} needs the equation that uses it`);
    assert.ok(c.family.values.length >= 2, `${c.id} needs a curve family`);
    assert.ok(c.value.max > c.value.min && c.sweep.max > c.sweep.min, `${c.id} has a bad axis`);
    // A log axis cannot start at zero.
    if (c.value.log) assert.ok(c.value.min > 0, `${c.id}: log value axis starts at zero`);
    if (c.sweep.log) assert.ok(c.sweep.min > 0, `${c.id}: log sweep axis starts at zero`);
  }
});

test("every anchor reproduces the book's own read", () => {
  // The tolerance is a chart-reading tolerance, because the target IS a chart
  // read: Huang eyeballed these off log paper. 8% of the printed value, or one
  // unit in its last printed digit, whichever is looser.
  let checked = 0;
  for (const c of CHARTS) {
    for (const a of c.anchors ?? []) {
      const expected = a.reads;
      assert.ok(Number.isFinite(expected), `${c.id}: anchor "${a.label}" has no printed value`);
      const got = c.evaluate(a.fv, a.sv, a.pv);
      assert.ok(Number.isFinite(got), `${c.id}: anchor evaluates to ${got}`);
      const decimals = (String(expected).split('.')[1] ?? '').length;
      const tol = Math.max(Math.abs(expected) * 0.08, Math.pow(10, -decimals));
      assert.ok(Math.abs(got - expected) <= tol,
        `${c.figure} anchor "${a.label}": computed ${got.toPrecision(4)}, printed ${expected}`);
      checked++;
    }
  }
  assert.ok(checked >= 12, `expected the worked examples to be covered, only checked ${checked}`);
});

test('every anchor sits inside its own chart frame', () => {
  // An anchor outside the axes would mean the frame was copied wrong.
  for (const c of CHARTS) {
    for (const a of c.anchors ?? []) {
      assert.ok(a.sv >= c.sweep.min && a.sv <= c.sweep.max,
        `${c.figure}: anchor sweep ${a.sv} is outside [${c.sweep.min}, ${c.sweep.max}]`);
      const v = c.evaluate(a.fv, a.sv, a.pv);
      assert.ok(v >= c.value.min && v <= c.value.max,
        `${c.figure}: anchor value ${v} is outside [${c.value.min}, ${c.value.max}]`);
    }
  }
});

test('every curve is drawable — on the axis and not empty', () => {
  // The failure this catches is a curve that computes fine but lies entirely
  // off the frame, which renders as a blank chart with a legend.
  for (const c of CHARTS) {
    // A heavy chart's panels cost seconds each; one is swept in full and the
    // rest are spot-checked by the anchor test above.
    const panels = c.panel ? (c.heavy ? [c.panel.values[0]] : c.panel.values) : [undefined];
    for (const p of panels) {
      for (const fv of c.family.values) {
        const pts = sampleCurve(c, fv, p);
        const drawn = pts.filter(q => Number.isFinite(q.value));
        assert.ok(drawn.length >= 3,
          `${c.figure}${p !== undefined ? ` panel ${p}` : ''}: curve ${c.family.symbol}=${fv} has ` +
          `only ${drawn.length} points on the chart`);
      }
    }
  }
});

test('at least half of each family stays on the frame for its whole sweep', () => {
  // Huang's curves mostly cross the whole page; a redraw where most curves
  // clip out after two points has the wrong axis limits, not the wrong physics.
  for (const c of CHARTS) {
    const p = c.panel ? c.panel.values[0] : undefined;
    const full = c.family.values.filter(fv => {
      const pts = sampleCurve(c, fv, p);
      return pts.filter(q => Number.isFinite(q.value)).length > 0.6 * pts.length;
    });
    assert.ok(full.length >= Math.ceil(c.family.values.length / 2),
      `${c.figure}: only ${full.length} of ${c.family.values.length} curves cross the frame`);
  }
});

/* ── Reading the chart backwards ─────────────────────────────────────────── */

test('the inverse recovers the parameter the value came from', () => {
  // Forward then backward: pick a curve, read a point off it, and ask which
  // curve that point is on. It must come back.
  for (const c of CHARTS) {
    const p = c.panel ? c.panel.values[0] : undefined;
    const mid = c.family.values[Math.floor(c.family.values.length / 2)];
    const sweep = c.sweep.log
      ? Math.sqrt(c.sweep.min * c.sweep.max)
      : 0.5 * (c.sweep.min + c.sweep.max);
    const target = c.evaluate(mid, sweep, p);
    if (!Number.isFinite(target)) continue;

    const roots = invertFamily(c, target, sweep, p);
    assert.ok(roots.length >= 1,
      `${c.figure}: no root recovered for ${c.family.symbol} = ${mid} at sweep ${sweep}`);
    const closest = roots.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
    const tol = Math.max(Math.abs(mid) * 0.02, 1e-3);
    assert.ok(Math.abs(closest - mid) <= tol,
      `${c.figure}: inverted to ${c.family.symbol} = ${closest}, expected ${mid}`);
  }
});

test('the inverse reports no root rather than inventing one', () => {
  // A cursor dropped somewhere no curve reaches is a real answer, and the
  // reader has to be told that instead of being handed a nearby number.
  const fig22 = chartById('fig-2-2');
  // No r/a gives 99% of q at a depth of five radii.
  assert.equal(invertFamily(fig22, 99, 5).length, 0,
    'sigma_z/q cannot be 99% at z/a = 5');
});

test('the inverse finds BOTH roots where a family hooks back', () => {
  // Figure 2.4's outer curves peak below the surface, so a tangential stress
  // just under the peak is reached at two different radii. A one-root
  // inversion would silently drop one of them.
  const fig24 = chartById('fig-2-4');
  const za = 0.5;
  // Sweep radii to find the peak of sigma_t at this depth...
  let peak = -Infinity, peakAt = 0;
  for (let i = 0; i <= 200; i++) {
    const ra = (i / 200) * 4;
    const v = fig24.evaluate(ra, za);
    if (Number.isFinite(v) && v > peak) { peak = v; peakAt = ra; }
  }
  // ...the peak is on the axis for sigma_t, so instead use the sweep
  // direction, where the hook lives: fix r/a and vary depth is monotone, but
  // fixing depth and varying r/a is monotone too. The genuine two-root case
  // is Figure 2.5, whose shear vanishes at both r/a -> 0 and r/a -> infinity.
  const fig25 = chartById('fig-2-5');
  const target = 5;      // 5% of q
  const roots = invertFamily(fig25, target, 1.0);
  assert.ok(roots.length >= 2,
    `tau_rz/q = ${target}% at z/a = 1 should be reached at two radii, got ${roots.length}: ${roots}`);
  for (const r of roots) {
    assert.ok(Math.abs(fig25.evaluate(r, 1.0) - target) < 0.05,
      `root r/a = ${r} does not reproduce the target`);
  }
  assert.ok(peakAt >= 0, 'sigma_t sweep ran');
});

test('nearestCurve snaps to a real curve, in screen terms', () => {
  const fig22 = chartById('fig-2-2');
  // It searches the curves already on screen rather than re-sampling them, so
  // the caller hands them in — this is what keeps a pointer move cheap on the
  // charts whose every point is a search.
  const drawn = fig22.family.values.map(fv => ({ fv, pts: sampleCurve(fig22, fv) }));

  // Sit exactly on the r/a = 2 curve at z/a = 3 and ask which curve it is.
  const za = 3, ra = 2;
  const v = fig22.evaluate(ra, za);
  const hit = nearestCurve(fig22, v, za, drawn);
  assert.equal(hit.familyValue, 2, `expected to snap to r/a = 2, got ${hit.familyValue}`);
  assert.ok(hit.distance < 0.02, `distance ${hit.distance} should be near zero on the curve`);
  // And that the distance really is screen-normalized: a point a decade away
  // on a five-decade log axis is about a fifth of the box, not "9 units".
  const far = nearestCurve(fig22, v / 10, za, drawn);
  assert.ok(far.distance < 1, 'screen distance stays inside the unit box');
  assert.ok(far.distance > hit.distance, 'a point off the curve must be further away');

  // Handed nothing drawn, it has nothing to snap to and says so.
  assert.equal(nearestCurve(fig22, v, za, []), null, 'no curves means no nearest curve');
});

/* ── The two rectified nomographs ────────────────────────────────────────── */

test('the rectified charts are flagged as rectified', () => {
  // Figures 2.21 and 2.31 are lattices over an abscissa carrying no variable.
  // They are redrawn on real axes, and the UI has to be able to say so.
  const rectified = CHARTS.filter(c => c.rectified).map(c => c.figure);
  assert.deepEqual(rectified.sort(), ['Figure 2.21', 'Figure 2.31'].sort());
  for (const c of CHARTS.filter(x => x.rectified)) {
    assert.ok((c.notes ?? []).length > 0, `${c.figure} must explain itself`);
  }
});

test('the panelled charts name every panel', () => {
  for (const c of CHARTS.filter(x => x.panel)) {
    const seen = new Set();
    for (const v of c.panel.values) {
      const name = c.panel.name ? c.panel.name(v) : String(v);
      assert.ok(name && name.length > 1, `${c.figure}: panel ${v} has no name`);
      assert.ok(!seen.has(name), `${c.figure}: duplicate panel name "${name}"`);
      seen.add(name);
    }
  }
});
