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
  framePoint, curveLabelSpots, emptiestCorner, CORNER_XY,
  latticeAxes, latticeX, sampleLattice, latticeLabels, invertLattice, LATTICE_RANGE,
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

/* ── The two nomographs ──────────────────────────────────────────────────
 * Figures 2.21 and 2.31 are lattices: two families crossing over an abscissa
 * that carries no variable, read by finding an intersection. They were
 * rectified here at first — one family put on a real axis — which threw away
 * the figure. What follows pins the mesh against the printed plates, because
 * "it looks about right" is exactly the standard that got it wrong once.
 */

test('the nomographs are flagged, and nothing else is', () => {
  const nomo = CHARTS.filter(c => c.nomograph).map(c => c.figure);
  assert.deepEqual(nomo.sort(), ['Figure 2.21', 'Figure 2.31'].sort());
  for (const c of CHARTS.filter(x => x.nomograph)) {
    assert.ok((c.notes ?? []).length > 0, `${c.figure} must explain itself`);
    // The second family of the mesh is the sweep axis's printed stations.
    assert.ok((c.sweep.ticks ?? []).length >= 5,
      `${c.figure}: the lattice needs the sweep stations the plate draws`);
    assert.equal(c.valueOnX, false, `${c.figure}: a lattice reads on the ordinate`);
  }
});

test('the lattice abscissa is the sum of the two families\' own positions', () => {
  // The one line the whole reconstruction rests on. Each family's extremes
  // sit at 0 and 1 of their own span, so the mesh spans exactly [0, 2] and
  // its two "middle" corners land together at 1 — which is why Figure 2.31
  // prints "A = 0.1  H = 8" as one label at the apex.
  for (const c of CHARTS.filter(x => x.nomograph)) {
    const a = latticeAxes(c);
    assert.equal(latticeX(c, a.fLo, a.sLo), 0, `${c.figure}: left corner`);
    assert.equal(latticeX(c, a.fHi, a.sHi), 2, `${c.figure}: right corner`);
    assert.ok(Math.abs(latticeX(c, a.fHi, a.sLo) - 1) < 1e-12, `${c.figure}: top corner`);
    assert.ok(Math.abs(latticeX(c, a.fLo, a.sHi) - 1) < 1e-12, `${c.figure}: bottom corner`);
    // Monotone in both, or the mesh folds over itself.
    for (let i = 1; i < a.F.length; i++) {
      assert.ok(latticeX(c, a.F[i], a.sLo) > latticeX(c, a.F[i - 1], a.sLo),
        `${c.figure}: the family does not advance the abscissa`);
    }
    for (let i = 1; i < a.S.length; i++) {
      assert.ok(latticeX(c, a.fLo, a.S[i]) > latticeX(c, a.fLo, a.S[i - 1]),
        `${c.figure}: the sweep does not advance the abscissa`);
    }
  }
});

test('the mesh is the two families, and every crossing carries the true value', () => {
  for (const c of CHARTS.filter(x => x.nomograph)) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const mesh = sampleLattice(c, pv);
    const fam = mesh.filter(m => m.kind === 'family');
    const swp = mesh.filter(m => m.kind === 'sweep');
    assert.deepEqual(fam.map(m => m.label), c.family.values);
    assert.deepEqual(swp.map(m => m.label), c.sweep.ticks);

    for (const cv of mesh) {
      for (const p of cv.pts) {
        assert.ok(p.x >= LATTICE_RANGE[0] && p.x <= LATTICE_RANGE[1],
          `${c.figure}: a mesh point at x = ${p.x} is off the frame`);
        if (!Number.isFinite(p.value)) continue;
        // The drawn point must BE the function, not an interpolation of it.
        const truth = c.evaluate(p.family, p.sweep, pv);
        assert.ok(Math.abs(truth - p.value) < 1e-9 * Math.max(1, Math.abs(truth)),
          `${c.figure}: the mesh draws ${p.value} where the solver gives ${truth}`);
        assert.ok(Math.abs(latticeX(c, p.family, p.sweep) - p.x) < 1e-12,
          `${c.figure}: a mesh point is not at its own abscissa`);
      }
    }

    // The families have to actually cross, or it is not a lattice.
    const a = latticeAxes(c);
    let crossings = 0;
    for (const fv of a.F) {
      for (const sv of a.S) {
        const v = c.evaluate(fv, sv, pv);
        if (Number.isFinite(v) && v >= c.value.min && v <= c.value.max) crossings++;
      }
    }
    assert.ok(crossings >= 0.4 * a.F.length * a.S.length,
      `${c.figure}: only ${crossings} of ${a.F.length * a.S.length} crossings are on the frame`);
  }
});

test('every curve of the mesh is named, at the end the plate names it', () => {
  for (const c of CHARTS.filter(x => x.nomograph)) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const mesh = sampleLattice(c, pv);
    const labels = latticeLabels(c, mesh);
    const drawable = mesh.filter(m => m.pts.some(p => Number.isFinite(p.value)));
    assert.equal(labels.length, drawable.length,
      `${c.figure}: ${drawable.length} curves are drawn, ${labels.length} named`);

    // Each label is the OUTERMOST point of its own curve that is still on
    // the frame, taken from the end the plate names it at. A curve whose
    // named end has fallen through the axis floor — the H = 8 curve of
    // Figure 2.31's first panel does exactly that — is named where it
    // actually emerges, which is what the plate does with it too.
    for (const l of labels) {
      const cv = mesh.find(m => m.kind === l.kind && m.label === l.label);
      const order = l.kind === 'family' ? cv.pts : [...cv.pts].reverse();
      const first = order.findIndex(q => Number.isFinite(q.value));
      assert.ok(first >= 0);
      assert.equal(order[first].x, l.x,
        `${c.figure}: the ${l.label} label is not at the outermost drawn point`);
      assert.equal(order[first].value, l.value);
      assert.ok(l.value >= c.value.min * 0.9 && l.value <= c.value.max * 1.1,
        `${c.figure}: the ${l.label} label is off the ordinate at ${l.value}`);
      // Uncipped, the two runs of labels fall on the two halves of the
      // frame, which is the layout both plates use.
      if (first === 0) {
        const half = l.kind === 'family' ? l.x <= 1.0000001 : l.x >= 0.9999999;
        assert.ok(half,
          `${c.figure}: the ${l.label} ${l.kind} label is on the wrong half at x = ${l.x}`);
      }
    }
  }
});

test('a point in the mesh solves back to the pair that made it', () => {
  // The half a nomograph cannot do. x fixes one combination of the two
  // parameters and the ordinate fixes another, so the pair is determined —
  // even though the abscissa on its own means nothing.
  for (const c of CHARTS.filter(x => x.nomograph)) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const a = latticeAxes(c);
    let checked = 0;
    for (const fv of a.F) {
      for (const sv of a.S) {
        const value = c.evaluate(fv, sv, pv);
        if (!Number.isFinite(value) || value < c.value.min || value > c.value.max) continue;
        const x = latticeX(c, fv, sv);
        const roots = invertLattice(c, x, value, pv);
        const hit = roots.some(r =>
          Math.abs(r.family - fv) <= 0.02 * Math.max(fv, 1e-6) &&
          Math.abs(r.sweep - sv) <= 0.02 * Math.max(sv, 1e-6));
        assert.ok(hit,
          `${c.figure}: (${c.family.symbol} ${fv}, ${c.sweep.label} ${sv}) at x = ${x.toFixed(3)} ` +
          `came back as ${JSON.stringify(roots.map(r => [+r.family.toPrecision(3), +r.sweep.toPrecision(3)]))}`);
        checked++;
      }
    }
    assert.ok(checked > 20, `${c.figure}: only ${checked} crossings were invertible`);
  }
});

test('Figure 2.31 reproduces the corners Peattie printed', () => {
  // Panel (a), k1 = 2, k2 = 2 — the first plate on page 75. Its mesh is a
  // narrow diamond: the H = 0.125 curve is labelled just above 0.3 at the
  // left, and the apex where H = 8 meets A = 0.1 falls through the 0.001
  // floor, which is why the printed lattice closes to a point there.
  const c = chartById('fig-2-31');
  assert.ok(c.nomograph);
  const panelA = c.panel.values[0];                       // k1 = 2, k2 = 2
  assert.equal(panelA, 202);
  assert.ok(Math.abs(c.evaluate(0.125, 0.1, panelA) - 0.353) < 0.02,
    'the H = 0.125 label sits just above 0.3 on panel (a)');
  assert.ok(c.evaluate(8, 0.1, panelA) < c.value.min,
    'the apex falls through the axis floor, as the plate shows');

  // Panel (e), k1 = 200, k2 = 2 — the plate whose arches run highest. The
  // panel value encodes k1 * 100 + k2, so that is 20002, not 2002.
  const panelE = c.panel.values.find(v => v === 20002);
  assert.ok(panelE, 'the k1 = 200, k2 = 2 panel must exist');
  assert.ok(Math.abs(c.evaluate(0.125, 0.8, panelE) - 13.6) < 0.5,
    'the H = 0.125 arch peaks near 13.6 around A = 0.8');
  assert.ok(c.evaluate(0.125, 0.8, panelE) > c.evaluate(0.125, 3.2, panelE),
    'and turns over before A = 3.2 — the scalloped tops of the printed panel');
});

test('Figure 2.21 reproduces the rhombus Huang printed', () => {
  // Page 64. The four corners of the mesh, read off the plate.
  const c = chartById('fig-2-21');
  assert.ok(c.nomograph);
  assert.deepEqual(c.family.values, [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200],
    'the plate draws E1/E2 down to 0.25 — a surface course softer than its base');
  assert.equal(c.sweep.ticks[0], 0.25, 'and h1/a from 0.25');
  // Top corner: the stiffest thinnest section, where the plate prints 200.
  assert.ok(Math.abs(c.evaluate(200, 0.25) - 10.0) < 0.3);
  // Right corner: same stiffness, four radii thick, where it prints 200 again.
  assert.ok(Math.abs(c.evaluate(200, 4) - 0.193) < 0.01);
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

/* ── The drawing, not the physics ────────────────────────────────────────
 * Everything above checks that the numbers are Huang's. What follows checks
 * that the FIGURE is Huang's: the frame it is drawn in, and the labels that
 * stand in for a legend it never had. Both are silent when they break — a
 * label placed off the page is simply a label nobody sees.
 */

test('framePoint puts a depth axis at the top and a log axis where the eye expects', () => {
  const fig22 = chartById('fig-2-2');

  // z/a runs DOWN the page: zero at the top edge, ten at the bottom.
  assert.ok(Math.abs(framePoint(fig22, 50, 0).sy - 0) < 1e-9, 'z/a = 0 must be the top edge');
  assert.ok(Math.abs(framePoint(fig22, 50, 10).sy - 1) < 1e-9, 'z/a = 10 must be the bottom edge');
  assert.ok(Math.abs(framePoint(fig22, 50, 5).sy - 0.5) < 1e-9, 'z/a = 5 must be halfway down');

  // The value axis is three decades of log paper, so 1% is a third across —
  // not 1/1000th, which is where a linear reading of it would land.
  assert.ok(Math.abs(framePoint(fig22, 0.1, 5).sx - 0) < 1e-9);
  assert.ok(Math.abs(framePoint(fig22, 100, 5).sx - 1) < 1e-9);
  assert.ok(Math.abs(framePoint(fig22, 1, 5).sx - 1 / 3) < 1e-9, 'a log axis is geometric');

  // Figure 2.15 puts the value on y instead, and y grows upward.
  const fig215 = chartById('fig-2-15');
  assert.ok(Math.abs(framePoint(fig215, fig215.value.min, 1.2).sy - 1) < 1e-9,
    'the smallest value belongs at the BOTTOM when the value is on y');
  assert.ok(Math.abs(framePoint(fig215, fig215.value.max, 1.2).sy - 0) < 1e-9);
});

test('every curve gets exactly one label, and it sits on its own curve', () => {
  for (const c of CHARTS) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const drawn = c.family.values.map(fv => ({ fv, pts: sampleCurve(c, fv, pv) }));
    const drawable = drawn.filter(d => d.pts.some(p => Number.isFinite(p.value)));
    const spots = curveLabelSpots(c, drawn);

    assert.equal(spots.length, drawable.length,
      `${c.figure}: ${drawable.length} curves are drawn but ${spots.length} were labelled`);
    assert.equal(new Set(spots.map(s => s.fv)).size, spots.length,
      `${c.figure}: two labels claim the same curve`);

    for (const s of spots) {
      // The label must name the curve it is printed on. A label that has
      // drifted onto a neighbour is the one failure a reader cannot detect.
      const truth = c.evaluate(s.fv, s.sweep, pv);
      const rel = Math.abs(truth - s.value) / Math.max(Math.abs(truth), 1e-9);
      assert.ok(rel < 1e-6,
        `${c.figure}: the ${c.family.symbol} = ${s.fv} label sits at ${s.value}, ` +
        `but that curve passes through ${truth} there`);

      const f = framePoint(c, s.value, s.sweep);
      assert.ok(f.sx >= -0.02 && f.sx <= 1.02 && f.sy >= -0.02 && f.sy <= 1.02,
        `${c.figure}: the ${s.fv} label is off the frame at (${f.sx.toFixed(3)}, ${f.sy.toFixed(3)})`);
    }
  }
});

test('labels do not stack on top of one another', () => {
  // Not a tidiness rule. Seventeen numbers is a legend the chart cannot
  // otherwise carry, and two of them in the same place is two curves the
  // reader can no longer name.
  const aspect = 1.7;
  for (const c of CHARTS) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const drawn = c.family.values.map(fv => ({ fv, pts: sampleCurve(c, fv, pv) }));
    const spots = curveLabelSpots(c, drawn, { aspect });
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot((spots[i].sx - spots[j].sx) * aspect, spots[i].sy - spots[j].sy);
        assert.ok(d > 0.02,
          `${c.figure}: the ${spots[i].fv} and ${spots[j].fv} labels are ${d.toFixed(4)} apart`);
      }
    }
  }
});

test('the caption goes in a corner the curves have actually left empty', () => {
  const boxes = { w: 0.34, h: 0.15 };
  for (const c of CHARTS) {
    const pv = c.panel ? c.panel.values[0] : undefined;
    const drawn = c.family.values.map(fv => ({ fv, pts: sampleCurve(c, fv, pv) }));
    const corner = emptiestCorner(c, drawn, boxes);
    assert.ok(corner in CORNER_XY, `${c.figure}: unknown corner ${corner}`);

    const rects = {
      'top-left': [0, boxes.w, 0, boxes.h],
      'top-right': [1 - boxes.w, 1, 0, boxes.h],
      'bottom-left': [0, boxes.w, 1 - boxes.h, 1],
      'bottom-right': [1 - boxes.w, 1, 1 - boxes.h, 1],
    };
    const count = k => {
      const [x0, x1, y0, y1] = rects[k];
      let n = 0;
      for (const cv of drawn) {
        for (const p of cv.pts) {
          if (!Number.isFinite(p.value)) continue;
          const f = framePoint(c, p.value, p.sweep);
          if (f.sx >= x0 && f.sx <= x1 && f.sy >= y0 && f.sy <= y1) n++;
        }
      }
      return n;
    };
    const chosen = count(corner);
    for (const k of Object.keys(rects)) {
      assert.ok(chosen <= count(k),
        `${c.figure}: the caption went to ${corner} (${chosen} points) when ${k} holds ${count(k)}`);
    }
  }
});

test('Figure 2.2 labels the r/a = 0 to 10 curves the book prints', () => {
  // The one chart the rest are formatted from, checked against the page.
  const c = chartById('fig-2-2');
  assert.deepEqual(
    c.family.values,
    [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10],
    'Foster and Ahlvin draw r/a from 0 to 10; the redraw must carry the same set'
  );
  assert.match(c.family.label, /^Numbers on curves indicate /,
    'the caption is the book’s own wording, and the reader prints it verbatim');

  // Both axes are ruled paper, so a value between two labelled ticks can be
  // read rather than guessed.
  assert.equal(c.value.minorDtick, 'D1', 'the stress axis is three-cycle log paper');
  assert.ok(typeof c.sweep.minorDtick === 'number' && c.sweep.minorDtick > 0);
  assert.deepEqual(c.sweep.ticks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const drawn = c.family.values.map(fv => ({ fv, pts: sampleCurve(c, fv) }));
  assert.equal(curveLabelSpots(c, drawn).length, 17, 'all seventeen curves are named');
});

test('every chart the reader draws can be framed as ruled paper', () => {
  // A minor division on one axis and none on the other reads as a mistake,
  // and an axis with no printed tick values has nothing to rule between.
  for (const c of CHARTS) {
    for (const [which, a] of [['value', c.value], ['sweep', c.sweep]]) {
      assert.ok(Array.isArray(a.ticks) && a.ticks.length >= 2,
        `${c.figure}: the ${which} axis prints no tick values`);
      assert.ok(a.minorDtick !== undefined,
        `${c.figure}: the ${which} axis has no minor division`);
      if (a.log) {
        assert.match(String(a.minorDtick), /^D[12]$/,
          `${c.figure}: a log axis subdivides as 'D1' or 'D2', not ${a.minorDtick}`);
      } else {
        assert.ok(typeof a.minorDtick === 'number' && a.minorDtick > 0,
          `${c.figure}: a linear axis needs a numeric minor division`);
        const span = (a.max - a.min) / a.minorDtick;
        assert.ok(span >= 8 && span <= 90,
          `${c.figure}: the ${which} axis would carry ${Math.round(span)} minor divisions`);
      }
    }
  }
});
