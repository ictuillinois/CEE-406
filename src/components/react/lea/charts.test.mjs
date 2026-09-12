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
  drawnValue, chartValue, clearChartCache, buildCurveCount,
  sampleCurveGen, sampleLatticeGen, runSampler,
} from './charts.ts';

test('the catalog covers every empirical chart in Chapter 2', () => {
  const figures = CHARTS.map(c => c.figure);
  for (const f of [
    'Figure 2.2', 'Figure 2.3', 'Figure 2.4', 'Figure 2.5', 'Figure 2.6',
    'Figure 2.14', 'Figure 2.15', 'Figure 2.15*', 'Figure 2.17', 'Figure 2.19', 'Figure 2.21',
    'Figure 2.23', 'Figure 2.25', 'Figure 2.26', 'Figure 2.27', 'Figure 2.31',
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
  // The one line the whole reconstruction rests on. The mesh spans exactly
  // [0, 2], and its two "middle" corners — (family high, sweep low) and
  // (family low, sweep high) — land on the SAME abscissa, which is why
  // Figure 2.31 prints "A = 0.1  H = 8" as one label at its apex. WHERE that
  // shared abscissa falls is the two families' relative gain, and it is not
  // always the middle: the next test pins it.
  for (const c of CHARTS.filter(x => x.nomograph)) {
    const a = latticeAxes(c);
    assert.equal(latticeX(c, a.fLo, a.sLo), 0, `${c.figure}: left corner`);
    assert.equal(latticeX(c, a.fHi, a.sHi), 2, `${c.figure}: right corner`);
    const top = latticeX(c, a.fHi, a.sLo), bottom = latticeX(c, a.fLo, a.sHi);
    assert.ok(Math.abs(top + bottom - 2) < 1e-12,
      `${c.figure}: the two apex ends must land on one abscissa`);
    assert.ok(top > 0.2 && top < 1.8, `${c.figure}: the apex is inside the frame`);
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

test('two log families share one ruler; a mixed pair cannot', () => {
  /* The abscissa is a ruler both families are laid along, and their relative
     gain is part of the drawing. Giving each family half the width is only
     right when the two measure different kinds of thing.

     Figure 2.31's families are both geometric ladders of ratio 2 — H over
     six doublings, A over five — so ONE doubling is one width in either, and
     the family takes 6/11 of the abscissa rather than 1/2. That 9% was
     measured against the plate, not argued: projected onto a 300 dpi scan of
     panel (a) with the horizontal rulings masked out, the shared ruler puts
     36 of the 39 crossings Table 2.3 tabulates on drawn ink; half-and-half
     puts 28, and its misses are the whole middle of the mesh.

     Figure 2.21's sweep h1/a is a LINEAR ladder against a logarithmic
     family. There is no shared ruler between those, so it keeps half each. */
  const f31 = chartById('fig-2-31'), a31 = latticeAxes(f31);
  assert.equal(a31.fLog, true); assert.equal(a31.sLog, true);
  assert.ok(Math.abs(a31.fWeight - 6 / 11) < 1e-12,
    `Figure 2.31 gives the family ${a31.fWeight} of the abscissa, not 6/11`);
  // Six doublings of H and five of A, each the same width.
  const stepH = latticeX(f31, 0.25, 0.1) - latticeX(f31, 0.125, 0.1);
  const stepA = latticeX(f31, 0.125, 0.2) - latticeX(f31, 0.125, 0.1);
  assert.ok(Math.abs(stepH - stepA) < 1e-12, 'a doubling must cost the same in either family');
  assert.ok(Math.abs(stepH - 2 / 11) < 1e-12);
  // And the apex where the two extreme labels are printed together.
  assert.ok(Math.abs(latticeX(f31, 8, 0.1) - 12 / 11) < 1e-12);
  assert.ok(Math.abs(latticeX(f31, 0.125, 3.2) - 10 / 11) < 1e-12);

  const f21 = chartById('fig-2-21'), a21 = latticeAxes(f21);
  assert.equal(a21.sLog, false, 'Figure 2.21 sweeps h1/a linearly');
  assert.equal(a21.fWeight, 0.5, 'a mixed pair has no shared ruler and keeps half each');
});

test('a nomograph is drawn in the plate own box', () => {
  /* The abscissa carries no variable, so nothing in the data says how wide
     the frame should be: on a nomograph the shape IS the drawing. Put in the
     1.4-to-1 box the other charts use, Figure 2.31's mesh is mathematically
     identical and visually wrong -- shallow arches, shelving legs, diamonds
     that read as lozenges, and a figure a reader cannot lay beside the page
     it reproduces. Both printed nomographs are TALLER than they are wide.
     Measured frame line to frame line on a 300 dpi scan. */
  for (const c of CHARTS) {
    if (!c.nomograph) {
      assert.equal(c.plotAspect, undefined, c.figure + ' is not a nomograph and needs no aspect');
      continue;
    }
    assert.ok(c.plotAspect > 0.5 && c.plotAspect < 1,
      c.figure + ': ' + c.plotAspect + ' -- both printed nomographs are taller than wide');
  }
  /* Both numbers are frame-line centres on a 300 dpi render of the page.
     2.31's was 1068/1401 = 0.762 and the HEIGHT of that pair was wrong: the
     same scan gives 535 x 733.5 = 0.729, and measuring 2.21 the same way
     reproduces its shipped number to 0.3%, so the method is sound and the
     old value was not. Four percent on a nomograph is visible -- the mesh
     came out wider than the plate's. */
  assert.ok(Math.abs(chartById('fig-2-31').plotAspect - 535 / 733.5) < 1e-9);
  assert.ok(Math.abs(chartById('fig-2-21').plotAspect - 910.5 / 1042.5) < 1e-9);
  assert.ok(Math.abs(chartById('fig-2-21').plotAspect - 756 / 868) < 0.005,
    'Figure 2.21 re-measured: 756 x 868 frame-line centres');
});

test('only a chart that declares a magnitude may put a negative on a log axis', () => {
  /* The defect that broke Figure 2.31 was structural, not local: a
     logarithmic ordinate cannot draw a negative, so a signed evaluator gets
     silently truncated wherever it changes sign, and the curve simply stops.
     Swept over every log-axis chart, only 2.31 goes negative — Foster and
     Ahlvin drew Figures 2.2 to 2.6 at nu = 0.5, where the (1 - 2nu) term
     that makes the surface radial stress negative vanishes identically — and
     2.31 declares `magnitude`. This is here so the next chart cannot acquire
     the same defect quietly. */
  const offenders = [];
  for (const c of CHARTS) {
    if (!c.value.log || c.magnitude) continue;
    const panels = c.panel ? c.panel.values : [undefined];
    const S = c.sweep;
    outer: for (const pv of panels) {
      for (const fv of c.family.values) {
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const sv = S.log
            ? Math.exp(Math.log(S.min) + t * (Math.log(S.max) - Math.log(S.min)))
            : S.min + t * (S.max - S.min);
          const v = c.evaluate(fv, sv, pv);
          if (Number.isFinite(v) && v < 0) {
            offenders.push(`${c.figure}: ${v.toExponential(2)} at ${c.family.symbol} ${fv}, sweep ${sv}`);
            break outer;
          }
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a log ordinate cannot draw these, so the curve stops there:\n' + offenders.join('\n'));
});

test('Figure 2.31 draws the magnitude, because its factor changes sign', () => {
  /* Table 2.3 tabulates (ZZ1 - RR1) and it goes NEGATIVE over a good part of
     the chart: for k1 = k2 = 2 and H = 0.125 it is +0.706 at A = 0.1 and
     -0.289 by A = 3.2. Peattie's ordinate is the other sign again and his
     axis is logarithmic, so what the plate draws is the absolute value, and
     it runs straight through the crossing without marking it.

     Returning the signed value to the sampler is what left this chart in
     pieces: every curve was cut at its first sign change, which on the k1 = 2
     panels is most of them. The sign is kept on `evaluate` so the sampler can
     find the zero; `drawnValue` is what reaches the page. */
  const c = chartById('fig-2-31');
  assert.equal(c.magnitude, true);
  assert.deepEqual(CHARTS.filter(x => x.magnitude).map(x => x.figure), ['Figure 2.31'],
    'no other chart draws a magnitude');
  assert.match(c.value.label, /^\|/, 'the ordinate has to say it is a magnitude');

  // Half of Table 2.3's H = 0.125, k1 = k2 = 2 row, straight off page 72.
  const table = [[0.1, 0.70622], [0.2, 0.97956], [0.4, 0.70970],
                 [0.8, 0.22319], [1.6, -0.19982], [3.2, -0.28916]];
  for (const [A, zz1rr1] of table) {
    const raw = c.evaluate(0.125, A, 202);
    assert.ok(Math.abs(raw - zz1rr1 / 2) < 0.006,
      `A = ${A}: solver ${raw} against Jones' ${zz1rr1 / 2}`);
    assert.ok(drawnValue(c, raw) >= 0, 'the page never draws a negative');
    assert.ok(Math.abs(drawnValue(c, raw) - Math.abs(zz1rr1 / 2)) < 0.006);
  }
  // The two negatives are the ones the old signed evaluate threw away.
  assert.ok(c.evaluate(0.125, 3.2, 202) < 0);
  assert.ok(drawnValue(c, c.evaluate(0.125, 3.2, 202)) > c.value.min);
});

test('no lattice curve stops in open space', () => {
  /* The plates are closed meshes. A curve runs to the end of its own
     parameter range, or it leaves through the frame, or -- on a magnitude
     chart -- it stops where the factor stops being tensile, and THAT end
     lands on another curve of the mesh rather than in open space. There is
     no fourth way for one to end.
     The third case is the one that decides whether Figure 2.31 looks like
     its plate. Peattie drew no compressive part of a tensile strain factor,
     so the printed mesh has a scalloped upper-left boundary, and every curve
     stopped that way ends exactly where a neighbour ends or crosses: the
     H = 0.125 curve of panel (a) stops at (A = 0.8, 0.1116), which is
     precisely where the A = 0.8 curve begins. Asserting that is what stops
     the truncation from ever becoming a set of loose ends. */
  for (const spec of CHARTS.filter(c => c.nomograph)) {
    const a = latticeAxes(spec);
    const FLOOR = spec.value.min, CEIL = spec.value.max;
    for (const pv of spec.panel ? spec.panel.values : [undefined]) {
      const mesh = sampleLattice(spec, pv);
      // Everything the mesh draws, for the "ends on another curve" test.
      const others = mesh.map(cv => cv.pts.filter(p => Number.isFinite(p.value)));
      for (const [ci, cv] of mesh.entries()) {
        // The abscissas this curve's own parameters can reach.
        const ends = cv.kind === 'family'
          ? [latticeX(spec, cv.label, a.sLo), latticeX(spec, cv.label, a.sHi)]
          : [latticeX(spec, a.fLo, cv.label), latticeX(spec, a.fHi, cv.label)];
        const runs = [];
        let run = null;
        for (const p of cv.pts) {
          if (Number.isFinite(p.value)) (run ??= []).push(p);
          else if (run) { runs.push(run); run = null; }
        }
        if (run) runs.push(run);

        /* And on a magnitude chart, ONE curve is ONE stroke with no spike in
           it. Both failures put the same thing on the page -- a lattice that
           does not read as a woven mesh -- and both came from the drawn
           value diving to zero at a sign change: first as a break where the
           curve left the frame, then as a three-decade notch once the zero
           was sampled. Stopping at the last tensile station is what makes
           this hold; the curve never reaches the zero to dive into. */
        if (spec.magnitude) {
          assert.equal(runs.length, 1,
            `${spec.figure} ${pv ?? ''} ${cv.kind} ${cv.label}: drawn in ${runs.length} pieces`);
          const on = runs[0];
          for (let i = 1; i < on.length - 1; i++) {
            const dip = Math.min(on[i - 1].value, on[i + 1].value) / on[i].value;
            assert.ok(dip <= 3,
              `${spec.figure} ${pv ?? ''} ${cv.kind} ${cv.label}: a ${dip.toFixed(0)}x notch ` +
              `at x = ${on[i].x.toFixed(3)} -- the plate draws through the sign change`);
          }
        }

        // Does any OTHER curve of the mesh pass through this point?
        const onNeighbour = (p) => others.some((pts, oi) => oi !== ci && pts.some(q =>
          Math.abs(q.x - p.x) < 1e-6 &&
          Math.abs(q.value - p.value) <= 1e-6 * Math.max(q.value, p.value)));

        for (const r of runs) {
          for (const p of [r[0], r[r.length - 1]]) {
            const ok = p.value <= FLOOR * 1.05 || p.value >= CEIL * 0.95 ||
              ends.some(e => Math.abs(p.x - e) < 1e-6) ||
              (spec.magnitude && onNeighbour(p));
            assert.ok(ok, `${spec.figure} ${pv ?? ''} ${cv.kind} ${cv.label}: ` +
              `a segment ends at x = ${p.x.toFixed(4)}, value ${p.value.toExponential(3)}, ` +
              `which is neither the frame, nor the end of its own range, nor a ` +
              `point another curve of the mesh passes through`);
          }
        }
      }
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
        // On a magnitude chart "the function" is what the plate draws.
        const truth = drawnValue(c, c.evaluate(p.family, p.sweep, pv));
        if (Math.abs(truth - p.value) >= 1e-9 * Math.max(1, Math.abs(truth))) {
          /* The one exception, and it is bounded rather than waived. Across
             a sign change the line is the plate's own (see bridgeSpans), so
             a point there is NOT the function -- but it still may not invent
             anything: it has to lie between the two tabulated values of the
             printed stations it sits between. That is the whole content of
             "this is Peattie's interpolation and nothing more". */
          assert.ok(c.magnitude, `${c.figure}: the mesh draws ${p.value} where the solver gives ${truth}`);
          const stations = cv.kind === 'family' ? (c.sweep.ticks ?? []) : c.family.values;
          const param = cv.kind === 'family' ? p.sweep : p.family;
          const below = stations.filter(v => v <= param * (1 + 1e-9));
          const above = stations.filter(v => v >= param * (1 - 1e-9));
          assert.ok(below.length && above.length,
            `${c.figure}: a bridged point at ${param} is outside the printed stations`);
          const ends = [Math.max(...below), Math.min(...above)]
            .map(v => drawnValue(c, c.evaluate(
              cv.kind === 'family' ? p.family : v,
              cv.kind === 'family' ? v : p.sweep, pv)));
          const lo = Math.min(...ends), hi = Math.max(...ends);
          assert.ok(p.value >= lo * (1 - 1e-6) && p.value <= hi * (1 + 1e-6),
            `${c.figure}: a bridged point draws ${p.value}, outside the ` +
            `[${lo}, ${hi}] its own stations span`);
        }
        assert.ok(Math.abs(latticeX(c, p.family, p.sweep) - p.x) < 1e-12,
          `${c.figure}: a mesh point is not at its own abscissa`);
      }
    }

    // The families have to actually cross, or it is not a lattice.
    const a = latticeAxes(c);
    let crossings = 0;
    for (const fv of a.F) {
      for (const sv of a.S) {
        const v = drawnValue(c, c.evaluate(fv, sv, pv));
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
    const drawable = mesh.filter(m => m.pts.some(p => Number.isFinite(p.value) &&
      p.value >= c.value.min && p.value <= c.value.max));
    assert.equal(labels.length, drawable.length,
      `${c.figure}: ${drawable.length} curves are drawn, ${labels.length} named`);

    // Each label is the outermost point of its own curve that is actually ON
    // the page, taken from the end the plate names it at. Not merely the
    // outermost DRAWN point: the samplers run a curve 10% past the ordinate
    // so it crosses the frame line rather than stopping on it, and a number
    // placed out there is clipped away. A curve whose named end has fallen
    // through the axis floor — the H = 8 curve of Figure 2.31's first panel
    // does exactly that — is named where it emerges, which is what the plate
    // does with it too.
    for (const l of labels) {
      const cv = mesh.find(m => m.kind === l.kind && m.label === l.label);
      const order = l.kind === 'family' ? cv.pts : [...cv.pts].reverse();
      const first = order.findIndex(q => Number.isFinite(q.value) &&
        q.value >= c.value.min && q.value <= c.value.max);
      assert.ok(first >= 0);
      assert.equal(order[first].x, l.x,
        `${c.figure}: the ${l.label} label is not at the outermost point on the page`);
      assert.equal(order[first].value, l.value);
      assert.ok(l.value >= c.value.min && l.value <= c.value.max,
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
        const value = drawnValue(c, c.evaluate(fv, sv, pv));
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
  // narrow diamond: the H = 0.125 curve is labeled just above 0.3 at the
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
      `${c.figure}: ${drawable.length} curves are drawn but ${spots.length} were labeled`);
    assert.equal(new Set(spots.map(s => s.fv)).size, spots.length,
      `${c.figure}: two labels claim the same curve`);

    for (const s of spots) {
      /* The label must name the curve it is printed on. A label that has
         drifted onto a neighbor is the one failure a reader cannot detect.

         Checked against the curve AS DRAWN rather than by re-evaluating the
         solver, because those are not the same thing everywhere any more:
         Figure 2.31 draws the plate's line across a sign change, and a label
         parked in that stretch -- which is exactly where the ink is
         sparsest, so exactly where the placer likes to put one -- is on its
         own curve while not being on the function. What a reader can check
         is the drawing. */
      const own = drawn.find(d => d.fv === s.fv).pts;
      const onOwn = own.some(q => Number.isFinite(q.value)
        && Math.abs(q.sweep - s.sweep) <= 1e-9 * Math.max(Math.abs(s.sweep), 1)
        && Math.abs(q.value - s.value) <= 1e-9 * Math.max(Math.abs(s.value), 1e-12));
      assert.ok(onOwn,
        `${c.figure}: the ${c.family.symbol} = ${s.fv} label sits at ` +
        `(${s.sweep}, ${s.value}), which is not a point of that curve`);

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

  // Both axes are ruled paper, so a value between two labeled ticks can be
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

test('Figure 2.15* is Figure 2.15 turned ninety degrees, and its axis agrees', () => {
  // The variant fixes E1/E2 = 100 and makes r/a the family. Its r/a = 0 curve
  // is therefore, point for point, the E1/E2 = 100 curve of the parent — the
  // two are the same solve read at the same station, so any drift means one
  // of them has stopped describing the section it names.
  const parent = chartById('fig-2-15');
  const variant = chartById('fig-2-15-ra');
  assert.ok(parent && variant, 'both figures must be in the catalog');

  for (const ah of [0.2, 0.6, 1.0, 1.4, 1.8, 2.2, 2.4]) {
    const onAxis = variant.evaluate(0, ah);
    const printed = parent.evaluate(100, ah);
    assert.ok(Math.abs(onAxis - printed) < 1e-9,
      `Figure 2.15* at r/a = 0, a/h1 = ${ah} reads ${onAxis}, ` +
      `Figure 2.15 at E1/E2 = 100 reads ${printed}`);
  }

  // The whole point of the variant: the stress falls off with radius, at
  // every thickness, monotonically. If it did not, there would be nothing to
  // read off the family.
  for (const ah of [0.4, 1.2, 2.4]) {
    let last = Infinity;
    for (const ra of variant.family.values) {
      const v = variant.evaluate(ra, ah);
      assert.ok(v > 0, `sigma_c/q must stay positive at r/a = ${ra}, a/h1 = ${ah}`);
      assert.ok(v < last,
        `sigma_c/q should fall with radius at a/h1 = ${ah}: r/a = ${ra} gave ${v} after ${last}`);
      last = v;
    }
  }

  // Both axes are the parent's, unchanged — that is what makes the two
  // comparable, and it is the reason the family sits low on the ordinate.
  assert.deepEqual(variant.value, parent.value, 'Figure 2.15* must keep the parent ordinate');
  assert.deepEqual(variant.sweep, parent.sweep, 'Figure 2.15* must keep the parent abscissa');
});

test('the percent charts name the two steps between a read and a stress', () => {
  // The four Foster-Ahlvin charts are the ones whose abscissa is a percentage
  // of q, and they are exactly the ones that must carry the conversion. A
  // chart that says "/100" in its equation but declares no `percent` would
  // leave the reader to do the arithmetic the readout exists to do.
  for (const c of CHARTS) {
    const equationDivides = c.equation.includes('/100');
    assert.equal(!!c.percent, equationDivides,
      `${c.id}: equation says "${c.equation}" but percent is ${JSON.stringify(c.percent)}`);
    if (!c.percent) continue;
    assert.ok(c.value.label.includes('100'),
      `${c.id}: declares percent but its axis is not a percentage`);
    assert.ok(c.percent.ratio.includes('/q'),
      `${c.id}: the ratio should be written over q`);
    assert.ok(c.percent.ratio.startsWith(c.percent.stress),
      `${c.id}: the ratio and the stress should name the same component`);
  }
  assert.equal(CHARTS.filter(c => c.percent).length, 4,
    'Figures 2.2, 2.3, 2.4 and 2.5 are the percent charts; no others');
});

test('a chart is a panel chart, a stacked chart, or neither — never two', () => {
  // `panel` is a chart you choose between; `stack` is a chart you read both
  // halves of. They are drawn by different paths, so a spec carrying both
  // would silently show one and ignore the other.
  for (const c of CHARTS) {
    assert.ok(!(c.panel && c.stack), `${c.id} declares both a panel and a stack`);
    if (c.nomograph) {
      assert.ok(!c.stack, `${c.id} is a nomograph and cannot be stacked`);
    }
    if (!c.stack) continue;
    assert.equal(c.stack.length, 2, `${c.id}: a stack is a pair, as the page prints it`);
    assert.notEqual(c.stack[0].pv, c.stack[1].pv, `${c.id}: both panels draw the same thing`);
    for (const panel of c.stack) {
      assert.ok(panel.label.length > 3, `${c.id}: a stacked panel needs a heading`);
    }
  }
});

test('the four conversion-factor figures are four figures', () => {
  // They used to be one entry with eight panels, which made a reader switch
  // panels to apply an equation that needs both of them at once. Huang prints
  // four separate figures, each a C1/C2 pair.
  const ids = ['fig-2-23', 'fig-2-25', 'fig-2-26', 'fig-2-27'];
  const specs = ids.map(id => chartById(id));
  for (let i = 0; i < ids.length; i++) {
    assert.ok(specs[i], `${ids[i]} is missing from the catalog`);
    assert.ok(specs[i].stack, `${ids[i]} must draw its C₁/C₂ pair together`);
    assert.equal(specs[i].heavy, true, `${ids[i]}: every point is a critical-strain search`);
  }

  // Each is a different tandem spacing, so at a section where the group
  // matters they must not all give the same number.
  const at = (spec, pv) => spec.evaluate(10, 16.7, pv);
  const c1 = specs.map(s => at(s, s.stack[0].pv));
  assert.equal(new Set(c1.map(v => v.toFixed(4))).size, ids.length,
    `the four figures returned ${c1.map(v => v.toFixed(3)).join(', ')} — they are not four figures`);

  // C₂ is the wider contact radius and reads higher than C₁ on all of them;
  // that ordering is what makes Eq. 2.19's interpolation an interpolation.
  for (const s of specs) {
    assert.ok(at(s, s.stack[1].pv) > at(s, s.stack[0].pv),
      `${s.id}: C₂ should exceed C₁ at Example 2.9's section`);
  }
});

test('no curve ends in open space — it runs to a label or off the frame', () => {
  // The one structural property every plate in this chapter has, and the one
  // a sampled redraw loses first. A curve ends in exactly two ways on the
  // page: at the end of its own parameter range, where the plate labels it,
  // or by leaving through the frame. What it must never do is stop in the
  // middle of the picture because the last sample that happened to be inside
  // the frame was there.
  //
  // Figure 2.31 broke this in four places: the strain factor changes sign in
  // one corner, so on a log ordinate it dives two decades inside a single
  // sample interval, and with 22 samples the curve simply stopped at 0.02
  // over a floor of 0.001. `edgeApproach` finds the crossing.
  // "On the frame" cannot mean "within a rounding error of the bound": the
  // crossing is found by bisecting one sample interval ten times, and where
  // the function is steep — Figure 2.3's radial stress runs off the left edge
  // as z/a -> 0 — the value still moves several percent across that last
  // 1/1024. A factor of three on a log axis, or 5% of the span on a linear
  // one, separates "ran off the page" from the defect this is here for, which
  // was a curve stopping 19 to 47 times the axis floor above it.
  const leftFrame = (spec, v) => (spec.value.log
    ? v <= spec.value.min * 3 || v >= spec.value.max / 3
    : v <= spec.value.min + 0.05 * (spec.value.max - spec.value.min) ||
      v >= spec.value.max - 0.05 * (spec.value.max - spec.value.min));

  for (const c of CHARTS) {
    const pv = c.panel ? c.panel.values[0] : c.stack ? c.stack[0].pv : undefined;
    const curves = c.nomograph
      ? sampleLattice(c, pv).map(m => ({ name: `${m.kind} ${m.label}`, pts: m.pts }))
      : c.family.values.map(fv => ({ name: `${c.family.symbol} = ${fv}`, pts: sampleCurve(c, fv, pv) }));

    for (const cv of curves) {
      const fin = cv.pts.map(p => Number.isFinite(p.value));
      const first = fin.indexOf(true), last = fin.lastIndexOf(true);
      if (first < 0) continue;                 // entirely off the page: nothing drawn

      if (first !== 0) {
        assert.ok(leftFrame(c, cv.pts[first].value),
          `${c.figure}, ${cv.name}: the curve begins in open space at ` +
          `${cv.pts[first].value} on an axis of [${c.value.min}, ${c.value.max}]`);
      }
      if (last !== cv.pts.length - 1) {
        assert.ok(leftFrame(c, cv.pts[last].value),
          `${c.figure}, ${cv.name}: the curve ends in open space at ` +
          `${cv.pts[last].value} on an axis of [${c.value.min}, ${c.value.max}]`);
      }
      // A gap in the middle is the same defect, one sample further in: both
      // sides of it have to be on the frame.
      for (let i = first; i < last; i++) {
        if (fin[i] && !fin[i + 1]) {
          assert.ok(leftFrame(c, cv.pts[i].value),
            `${c.figure}, ${cv.name}: a break starts in open space at ${cv.pts[i].value}`);
        }
        if (!fin[i] && fin[i + 1]) {
          assert.ok(leftFrame(c, cv.pts[i + 1].value),
            `${c.figure}, ${cv.name}: a break ends in open space at ${cv.pts[i + 1].value}`);
        }
      }
    }
  }
});

/* ── The memo ────────────────────────────────────────────────────────────
 * `chartValue` exists because one point of a conversion chart is 37 ms of
 * layered-elastic solving and five places in the reader ask for the same
 * points. Two things have to hold or it is worse than nothing: it must
 * answer exactly what `evaluate` answers, and the key must actually LAND on
 * the table's stations, which arrive by a different arithmetic route from
 * the sampler's.
 */
test('the memo answers exactly what evaluate answers', () => {
  clearChartCache();
  for (const c of CHARTS) {
    const pv = c.panel ? c.panel.values[0] : c.stack ? c.stack[0].pv : undefined;
    for (const fv of c.family.values.slice(0, 3)) {
      for (const t of [0, 0.37, 1]) {
        const sv = c.sweep.min + t * (c.sweep.max - c.sweep.min);
        const direct = c.evaluate(fv, sv, pv);
        const cold = chartValue(c, fv, sv, pv);
        const warm = chartValue(c, fv, sv, pv);
        // Identical, not close: a memo that returns a different number from
        // the function it stands in for is a bug wearing a cache.
        assert.ok(Object.is(direct, cold) || direct === cold,
          `${c.figure}: memo gave ${cold}, evaluate gives ${direct}`);
        assert.ok(Object.is(cold, warm) || cold === warm,
          `${c.figure}: the second read gave ${warm}, the first ${cold}`);
      }
    }
  }
});

test("the table's stations are the curves' own points, so the memo catches them", () => {
  // The reader draws the curves, then reads a table at every printed station
  // of the sweep. Those stations are put into the sample set by name, so the
  // table must be answerable without a single new solve -- which is what
  // takes Figure 2.27's table from seven seconds to nothing. The sampler
  // reaches them through a parameter round trip, so this is really a test
  // that the key's twelve significant figures absorb it.
  for (const c of CHARTS) {
    if (!c.heavy) continue;
    const pv = c.panel ? c.panel.values[0] : c.stack ? c.stack[0].pv : undefined;
    const stations = (c.sweep.ticks ?? []).filter(v => v >= c.sweep.min && v > 0).slice(0, 8);
    assert.ok(stations.length, `${c.figure}: no printed stations to check`);

    clearChartCache();
    let solves = 0;
    const real = c.evaluate;
    c.evaluate = (...a) => { solves++; return real(...a); };
    try {
      if (c.nomograph) sampleLattice(c, pv);
      else for (const fv of c.family.values) sampleCurve(c, fv, pv);
      const afterBuild = solves;
      for (const s of stations) {
        for (const fv of c.family.values) chartValue(c, fv, s, pv);
      }
      assert.equal(solves, afterBuild,
        `${c.figure}: the table cost ${solves - afterBuild} fresh solves; ` +
        'every station should already be a drawn vertex');
    } finally {
      c.evaluate = real;
    }
  }
});

test('the progress bar counts a unit the build actually arrives in', () => {
  // docs/loaders.md §7.6: never fake a bar you cannot honor. The reader's
  // bar is curves-done over buildCurveCount, so if that count disagrees with
  // what the build loop produces the bar either stops short of the end or
  // runs past it. Both are the same defect and neither is visible in CI
  // unless it is asserted here.
  for (const c of CHARTS) {
    const panels = c.stack ? c.stack.length : 1;
    const pv = c.panel ? c.panel.values[0] : c.stack ? c.stack[0].pv : undefined;
    const claimed = buildCurveCount(c, panels);
    const actual = c.nomograph
      ? sampleLattice(c, pv).length
      : panels * c.family.values.length;
    assert.equal(claimed, actual, `${c.figure}: the bar counts ${claimed} curves, the build draws ${actual}`);
  }
});

test('a sampler driven by hand gives what the sampler gives', () => {
  // The reader drives the generators itself so it can hand the thread back
  // between vertices. Stepping one has to end where running it does, or the
  // figure the reader draws is not the figure the tests check.
  for (const c of CHARTS) {
    if (c.heavy) continue;                    // covered by the pair below
    const pv = c.panel ? c.panel.values[0] : c.stack ? c.stack[0].pv : undefined;
    const fv = c.family.values[Math.floor(c.family.values.length / 2)];
    assert.deepEqual(runSampler(sampleCurveGen(c, fv, pv)), sampleCurve(c, fv, pv),
      `${c.figure}: the generator and the wrapper disagree`);
  }
  const nomo = CHARTS.find(c => c.nomograph);
  assert.deepEqual(
    runSampler(sampleLatticeGen(nomo, nomo.panel?.values[0])),
    sampleLattice(nomo, nomo.panel?.values[0]),
    `${nomo.figure}: the lattice generator and the wrapper disagree`);
});
