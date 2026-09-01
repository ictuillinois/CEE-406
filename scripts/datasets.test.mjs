// Tests for per-student dataset generation. Run with:
//   node --experimental-strip-types --test scripts/datasets.test.mjs
//
// The important tests here are not "does it emit numbers" but "is the data
// solvable" — every generated dataset is pushed back through the same tool a
// student would use, and the hidden truth must come out the other side. A
// generator that produced plausible-looking but unsolvable data would be worse
// than no generator at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSeed, rng, makeDraw, studentBundle, studentFiles, answerKey,
  mrModel, resilientModulusSet, cbrCurve, w4Table, fwdSurvey, FWD_OFFSETS,
  drainageSite, idotScenario, rigidSlab,
} from './datasets.mjs';
import { basin, backcalculate } from '../src/components/react/backcalc/equations.ts';
import { reduceCbr } from '../src/components/react/cbr/equations.ts';
import {
  filterCriteria, infiltrationRidgeway, designInflow, drainageCapacity,
  groundwaterAboveDrain, groundwaterInflow, timeToDrain,
} from '../src/components/react/drainage/equations.ts';
import { slabResponses, curlingStresses } from '../src/components/react/westergaard/equations.ts';
import { pcaAnalyze } from '../src/components/react/pca/equations.ts';

const SALT = 'test-salt-not-a-real-one';
const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* ─────────────────────────── Determinism ───────────────────────────────── */

test('the same UIN and salt always give the same data', () => {
  const a = studentBundle('123456789', SALT, basin);
  const b = studentBundle('123456789', SALT, basin);
  assert.deepEqual(a, b);
});

test('different students get different data', () => {
  const a = studentBundle('123456789', SALT, basin);
  const b = studentBundle('123456790', SALT, basin);
  assert.notDeepEqual(a.hw2.mr.points, b.hw2.mr.points);
  assert.notDeepEqual(a.hw5.groups, b.hw5.groups);
});

test('changing the salt changes everything', () => {
  const a = studentBundle('123456789', SALT, basin);
  const b = studentBundle('123456789', 'a-different-semester', basin);
  assert.notDeepEqual(a.hw2.mr, b.hw2.mr);
  assert.notEqual(a.hw2.cbr.cbrTrue, b.hw2.cbr.cbrTrue);
});

test('the hash is stable, so keys re-derive months later', () => {
  assert.equal(hashSeed('abc'), hashSeed('abc'));
  assert.notEqual(hashSeed('abc'), hashSeed('abd'));
});

/* ───────────────── HW2 · the Mr data is actually fittable ──────────────── */

const PA = 14.696;

/** The same log-space multiple regression the Mr Fitter runs. */
function fitK(points) {
  const x1 = [], x2 = [], y = [];
  for (const p of points) {
    const theta = p.sd + 3 * p.s3;
    const tau = (Math.SQRT2 * p.sd) / 3;
    x1.push(Math.log(theta / PA));
    x2.push(Math.log(tau / PA + 1));
    y.push(Math.log(p.mr / PA));
  }
  const n = y.length;
  let s1 = 0, s2 = 0, sy = 0, s11 = 0, s22 = 0, s12 = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < n; i++) {
    s1 += x1[i]; s2 += x2[i]; sy += y[i];
    s11 += x1[i] ** 2; s22 += x2[i] ** 2; s12 += x1[i] * x2[i];
    s1y += x1[i] * y[i]; s2y += x2[i] * y[i];
  }
  const A = [[n, s1, s2], [s1, s11, s12], [s2, s12, s22]];
  const b = [sy, s1y, s2y];
  // Gaussian elimination on the 3x3 normal equations.
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 3; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const [b0, k2, k3] = [b[0] / A[0][0], b[1] / A[1][1], b[2] / A[2][2]];
  return { k1: Math.exp(b0), k2, k3 };
}

test('the generated triaxial data regresses back to its own k values', () => {
  for (const uin of ['100000001', '100000002', '100000003']) {
    const b = studentBundle(uin, SALT, null);
    const clean = b.hw2.mr.points.filter(p => !p.outlier);
    const fit = fitK(clean);
    near(fit.k1, b.hw2.mr.k1, 0.10, `${uin} k1`);
    near(fit.k2, b.hw2.mr.k2, 0.12, `${uin} k2`);
    assert.ok(Math.abs(fit.k3 - b.hw2.mr.k3) < 0.12, `${uin} k3: ${fit.k3} vs ${b.hw2.mr.k3}`);
  }
});

test('the injected outliers really are outliers', () => {
  const b = studentBundle('100000004', SALT, null);
  const { points, k1, k2, k3 } = b.hw2.mr;
  for (const p of points) {
    const expected = mrModel(k1, k2, k3, p.s3, p.sd);
    const dev = Math.abs(p.mr / expected - 1);
    if (p.outlier) assert.ok(dev > 0.15, `outlier deviates by ${(100 * dev).toFixed(0)}%`);
    else assert.ok(dev < 0.20, `clean point deviates by only ${(100 * dev).toFixed(0)}%`);
  }
});

test('outliers are never the first or last readings', () => {
  for (let i = 0; i < 25; i++) {
    const b = studentBundle(`20000000${i}`, SALT, null);
    for (const row of b.hw2.mr.outlierRows) {
      assert.ok(row > 4 && row < 27, `outlier at row ${row} is too easy to spot`);
    }
  }
});

test('30 points, two of them spoiled', () => {
  const b = studentBundle('100000005', SALT, null);
  assert.equal(b.hw2.mr.points.length, 30);
  assert.equal(b.hw2.mr.points.filter(p => p.outlier).length, 2);
});

/* ──────────────── HW2 · the CBR curve reduces to its own CBR ───────────── */

test('the generated penetration curve returns the CBR it was built from', () => {
  for (const uin of ['300000001', '300000002', '300000003', '300000004']) {
    const b = studentBundle(uin, SALT, null);
    const r = reduceCbr(b.hw2.cbr.readings.map(x => ({ pen: x.pen, load: x.load })), true);
    assert.ok(r, 'the curve reduced');
    // The tangent construction recovers the origin, so the corrected CBR at
    // 0.1 in should land on the value the curve was generated from.
    near(r.cbr01, b.hw2.cbr.cbrTrue, 0.12, `${uin} CBR`);
  }
});

test('every generated curve is concave up, so the correction matters', () => {
  for (const uin of ['400000001', '400000002', '400000003']) {
    const b = studentBundle(uin, SALT, null);
    const pts = b.hw2.cbr.readings.map(x => ({ pen: x.pen, load: x.load }));
    const corrected = reduceCbr(pts, true);
    const raw = reduceCbr(pts, false);
    assert.ok(corrected.offset > 0.005, `${uin}: origin correction is ${corrected.offset}`);
    assert.ok(corrected.cbr01 > raw.cbr01,
      `${uin}: the correction should raise the CBR (${raw.cbr01} → ${corrected.cbr01})`);
  }
});

/* ───────────────── HW5 · the W-4 table scales up correctly ─────────────── */

test('the W-4 table counts far more axles than it weighs', () => {
  const b = studentBundle('500000001', SALT, null);
  const weighedS = b.hw5.groups.filter(g => g.type === 'single').reduce((s, g) => s + g.weighed, 0);
  assert.equal(weighedS, b.hw5.weighed.single);
  assert.ok(b.hw5.counted.single > 2 * weighedS, 'counted exceeds weighed by a realistic factor');
  assert.ok(b.hw5.trucksCounted > 0);
});

test('the load spectrum has mass across the groups', () => {
  const b = studentBundle('500000002', SALT, null);
  const singles = b.hw5.groups.filter(g => g.type === 'single');
  assert.ok(singles.every(g => g.weighed >= 1), 'no empty groups');
  const total = singles.reduce((s, g) => s + g.weighed, 0);
  const peak = Math.max(...singles.map(g => g.weighed));
  assert.ok(peak < 0.8 * total, 'the spectrum is not a single spike');
});

/* ─────────── HW10 · the FWD survey is backcalculable to its truth ──────── */

test('a generated basin backcalculates to the moduli that made it', () => {
  const b = studentBundle('600000001', SALT, basin);
  const s = b.hw10.stations[0];
  const q = b.hw10.P / (Math.PI * b.hw10.a ** 2);
  const measured = s.mils.map(m => m * 0.001);

  const seed = [
    { h: b.hw10.hAc, E: 250000, nu: 0.35 },
    { h: b.hw10.hBase, E: 20000, nu: 0.35 },
    { h: 0, E: 9000, nu: 0.40 },
  ];
  const fit = backcalculate(seed, q, b.hw10.a, b.hw10.offsets, measured,
    { lo: [3000, 3000, 1500], hi: [3e6, 3e5, 3e5], tolPct: 0.1 });

  assert.ok(fit.rmsPct < 3, `basin matched to ${fit.rmsPct.toFixed(2)}% RMS`);
  // 1.5% measurement noise means the recovered subgrade should be close but
  // not exact — which is the honest situation and what HW10 P5 is about.
  near(fit.E[2], s.truth[2], 0.15, 'subgrade modulus recovered');
});

test('the survey contains a real section break the student can find', () => {
  const b = studentBundle('600000002', SALT, basin);
  const { truth, stations } = b.hw10;
  assert.ok(truth.sgStrong > 1.5 * truth.sgWeak, 'the break is large enough to detect');

  const breakIdx = stations.findIndex(s => s.station === truth.breakAtStation);
  assert.ok(breakIdx > 0 && breakIdx < 10, 'the break is inside the project');

  // The outer sensor sees the subgrade, so it should step at the break.
  const outer = stations.map(s => s.mils[s.mils.length - 1]);
  const before = outer.slice(0, breakIdx).reduce((x, y) => x + y, 0) / breakIdx;
  const after = outer.slice(breakIdx).reduce((x, y) => x + y, 0) / (10 - breakIdx);
  assert.ok(before > after * 1.15,
    `d60 should drop across the break (${before.toFixed(2)} → ${after.toFixed(2)} mils)`);
});

test('ten stations, seven sensors each', () => {
  const b = studentBundle('600000003', SALT, basin);
  assert.equal(b.hw10.stations.length, 10);
  assert.equal(b.hw10.offsets.length, FWD_OFFSETS.length);
  for (const s of b.hw10.stations) assert.equal(s.mils.length, FWD_OFFSETS.length);
});

/* ───────────────────────── Files and answer key ────────────────────────── */

test('student files carry no truth values', () => {
  // Two false alarms had to be designed out of this test, and both are worth
  // recording. A substring match flags a true CBR of 12.7 inside an innocent
  // deflection of 12.79. A match across all files flags a true CBR of 5.9
  // against the plate radius, which is 5.9 for everyone. Neither tells a
  // student anything. The meaningful check is narrower: a truth value must not
  // appear in the file it belongs to, in a column where it would be read as
  // that quantity.
  const cellsOf = (body, skipCol = -1) => {
    const out = new Set();
    for (const line of body.split(/\r?\n/)) {
      line.split(',').forEach((cell, i) => { if (i !== skipCol) out.add(cell.trim()); });
    }
    return out;
  };

  for (const uin of ['700000001', '700000002', '700000003', '700000004', '700000005']) {
    const b = studentBundle(uin, SALT, basin);
    const files = studentFiles(b);

    const mrCells = cellsOf(files['hw2-resilient-modulus.csv']);
    for (const [label, v] of [['k1', b.hw2.mr.k1], ['k2', b.hw2.mr.k2], ['k3', b.hw2.mr.k3]]) {
      assert.ok(!mrCells.has(String(v)), `${uin}: ${label} (${v}) is printed in the Mr handout`);
    }

    // Column 0 of the CBR file is the fixed penetration grid; the origin
    // correction landing on one of those values is a coincidence, not a tell.
    const cbrCells = cellsOf(files['hw2-cbr.csv'], 0);
    assert.ok(!cbrCells.has(String(b.hw2.cbr.cbrTrue)),
      `${uin}: the true CBR (${b.hw2.cbr.cbrTrue}) is printed in the CBR handout`);
    assert.ok(!cbrCells.has(String(b.hw2.cbr.offset)),
      `${uin}: the origin correction (${b.hw2.cbr.offset}) is printed in the CBR handout`);

    // Nothing anywhere may be *labeled* as truth.
    const blob = Object.values(files).join('\n');
    assert.ok(!/outlier/i.test(blob), `${uin}: outliers must not be labeled`);
    assert.ok(!/\btruth\b/i.test(blob), `${uin}: no truth column anywhere`);
    assert.ok(!/\bbreak\b/i.test(blob), `${uin}: the section break must not be marked`);
    assert.ok(!/\bk[123]\b/i.test(blob), `${uin}: no k-value column anywhere`);
  }
});

test('the handout has the files each homework needs', () => {
  const files = studentFiles(studentBundle('700000002', SALT, basin));
  for (const name of [
    'hw2-resilient-modulus.csv', 'hw2-cbr.csv',
    'hw5-w4-table.csv', 'hw10-fwd-survey.csv', 'assignments.csv',
  ]) {
    assert.ok(files[name], `missing ${name}`);
    assert.ok(files[name].split('\n').length > 3, `${name} looks empty`);
  }
});

test('the answer key carries what the handout does not', () => {
  const b = studentBundle('700000003', SALT, basin);
  const key = answerKey(b);
  assert.equal(key.k1, undefined);
  assert.equal(key.hw2_mr.k1, b.hw2.mr.k1);
  assert.deepEqual(key.hw2_mr.outlier_rows, b.hw2.mr.outlierRows);
  assert.equal(key.hw2_cbr.cbr_true, b.hw2.cbr.cbrTrue);
  assert.equal(key.hw10.truth.breakAtStation, b.hw10.truth.breakAtStation);
});

/* ──────────────────────────── Draw helpers ─────────────────────────────── */

test('the normal sampler has the right mean and spread', () => {
  const d = makeDraw(rng(12345));
  const xs = Array.from({ length: 20000 }, () => d.normal());
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  assert.ok(Math.abs(mean) < 0.03, `mean ${mean}`);
  near(sd, 1, 0.03, 'standard deviation');
});

/* ═══════════════════ HW6 · the drainage site is designable ══════════════ */

/** A spread of students, for the distribution-level assertions. */
const cohort = (n, prefix) =>
  Array.from({ length: n }, (_, i) =>
    studentBundle(prefix + String(i).padStart(5, '0'), SALT, null));

test('every generated gradation is physically ordered', () => {
  for (const b of cohort(40, '9200')) {
    const { subgrade: sg, filter: f } = b.hw6.gradation;
    assert.ok(sg.d15 < sg.d50 && sg.d50 < sg.d85, `subgrade out of order: ${JSON.stringify(sg)}`);
    assert.ok(f.d15 < f.d50 && f.d50 < f.d85, `filter out of order: ${JSON.stringify(f)}`);
  }
});

test('the class contains both passing and failing filters', () => {
  // HW6 P5 asks students to propose a fix "where they fail". If the generator
  // produced only passes the part is empty; only failures and it is a
  // formality. Both cases have to be in the room.
  const verdicts = cohort(60, '9300')
    .map(b => filterCriteria(b.hw6.gradation.filter, b.hw6.gradation.subgrade).allPass);
  const passes = verdicts.filter(Boolean).length;
  assert.ok(passes >= 12 && passes <= 48,
    `${passes}/60 filters pass — wanted a genuine mix, not a landslide either way`);
});

test('each individual criterion is exercised, not just the overall verdict', () => {
  const tally = {};
  for (const b of cohort(60, '9400')) {
    for (const c of filterCriteria(b.hw6.gradation.filter, b.hw6.gradation.subgrade).checks) {
      tally[c.name] ??= { pass: 0, fail: 0 };
      tally[c.name][c.pass ? 'pass' : 'fail']++;
    }
  }
  // Piping and uniformity must both be live questions. Permeability is
  // expected to pass almost always — a filter coarser than a fine subgrade
  // always drains faster — and that is worth a student noticing.
  for (const name of Object.keys(tally)) {
    if (/Permeability/.test(name)) {
      assert.ok(tally[name].pass >= 55, `${name} should nearly always pass`);
    } else {
      assert.ok(tally[name].pass > 5 && tally[name].fail > 5,
        `${name} is one-sided: ${JSON.stringify(tally[name])}`);
    }
  }
});

test('the drainage layer can carry the inflow it is given', () => {
  let ok = 0;
  const list = cohort(40, '9500');
  for (const b of list) {
    const inf = infiltrationRidgeway(b.hw6.lanes, b.hw6.Wp, b.hw6.Cs);
    const q1 = groundwaterAboveDrain(b.hw6.groundwater.kSubgrade, b.hw6.groundwater.H, b.hw6.groundwater.H0);
    const { qg } = groundwaterInflow(q1, q1 * 0.4, b.hw6.Wp / 2, false);
    const qd = designInflow(inf.qArea * 24, qg, 0);
    assert.ok(Number.isFinite(qd.governing) && qd.governing > 0, 'design inflow is a real number');
    const cap = drainageCapacity(b.hw6.layer.k, b.hw6.layer.H, b.hw6.layer.S, b.hw6.layer.L);
    if (cap > qd.governing * b.hw6.layer.L) ok++;
  }
  // Most sites should be designable as issued; a few that are not give the
  // student something to fix, which is the point of P3.
  assert.ok(ok >= 0.85 * list.length, `${ok}/${list.length} sites drain as issued`);
});

test('time to 50% drainage lands in a range worth arguing about', () => {
  for (const b of cohort(30, '9600')) {
    // T = 0.5 is a representative time factor off the degree-of-drainage chart.
    const t = timeToDrain(b.hw6.layer.ne, b.hw6.layer.L, b.hw6.layer.k, b.hw6.layer.H, 0.5);
    assert.ok(t > 0 && t < 60, `time to drain ${t.toFixed(2)} days is outside a teachable range`);
  }
});

/* ══════════════════════ HW8 · the IDOT scenario holds up ════════════════ */

test('the IDOT scenario has positive traffic and a usable trial section', () => {
  for (const b of cohort(30, '9700')) {
    assert.ok(b.hw8.PV > 0 && b.hw8.SU > 0 && b.hw8.MU > 0, 'all three vehicle classes present');
    assert.ok(b.hw8.trial.hAc >= 4 && b.hw8.trial.hBase >= 4, 'the trial section is buildable');
    assert.ok(/^PG \d\d-\d\d$/.test(b.hw8.binder), `binder grade malformed: ${b.hw8.binder}`);
    assert.ok(b.hw8.performancePeriod >= 15);
  }
});

test('the seasonal moduli have the right physics', () => {
  for (const b of cohort(30, '9800')) {
    // Asphalt stiffens as it cools, so the spring-thaw AC modulus must exceed
    // the summer one — students who assume the opposite get HW8 P3 backwards.
    assert.ok(b.hw8.seasonalAcModulus.springThaw > b.hw8.seasonalAcModulus.summer,
      'cold asphalt is stiffer than hot asphalt');
    // The subgrade, meanwhile, is weaker in spring thaw.
    assert.ok(b.hw8.springThawSubgradeFactor > 0 && b.hw8.springThawSubgradeFactor < 1,
      'spring thaw weakens the subgrade');
  }
});

test('the trial section is analyzable by the layered-elastic solver', () => {
  const b = studentBundle('990000001', SALT, basin);
  const q = b.hw8.trial.wheelLoad / (Math.PI * b.hw8.trial.contactRadius ** 2);
  const layers = [
    { h: b.hw8.trial.hAc, E: b.hw8.seasonalAcModulus.summer, nu: 0.35 },
    { h: b.hw8.trial.hBase, E: 30000, nu: 0.35 },
    { h: 0, E: 8000, nu: 0.40 },
  ];
  const w = basin(layers, q, b.hw8.trial.contactRadius, [0, 12, 24]);
  assert.ok(w && w.every(x => x > 0 && Number.isFinite(x)), 'the section produces a real basin');
});

/* ═══════════════════════ HW9 · the slab is designable ═══════════════════ */

test('the rigid slab lands where the design decision is real', () => {
  const ratios = [];
  for (const b of cohort(40, '9900')) {
    const a = Math.sqrt(b.hw9.load.wheelLoad / (Math.PI * b.hw9.load.contactPressure));
    const r = slabResponses(b.hw9.slab.E, b.hw9.slab.h, b.hw9.slab.nu, b.hw9.slab.k, b.hw9.load.wheelLoad, a);
    assert.ok(r, 'the slab solves');
    ratios.push(r.governing.stress / b.hw9.slab.modulusOfRupture);
  }
  // Every slab must be neither trivially safe nor absurdly overstressed — the
  // thickness question has to have a real answer for every student.
  const lo = Math.min(...ratios), hi = Math.max(...ratios);
  assert.ok(lo > 0.2, `some slab is trivially safe at sigma/MR = ${lo.toFixed(2)}`);
  assert.ok(hi < 1.35, `some slab is hopeless at sigma/MR = ${hi.toFixed(2)}`);
});

test('the slab curls measurably in both directions', () => {
  for (const b of cohort(25, '9950')) {
    const a = Math.sqrt(b.hw9.load.wheelLoad / (Math.PI * b.hw9.load.contactPressure));
    const r = slabResponses(b.hw9.slab.E, b.hw9.slab.h, b.hw9.slab.nu, b.hw9.slab.k, b.hw9.load.wheelLoad, a);
    const day = curlingStresses(b.hw9.slab.E, b.hw9.slab.nu, r.ell,
      b.hw9.joints.spacing * 12, b.hw9.joints.laneWidth * 12, b.hw9.joints.alpha, b.hw9.joints.dtDay);
    const night = curlingStresses(b.hw9.slab.E, b.hw9.slab.nu, r.ell,
      b.hw9.joints.spacing * 12, b.hw9.joints.laneWidth * 12, b.hw9.joints.alpha, b.hw9.joints.dtNight);
    assert.ok(day.interiorX > 0, 'a positive gradient curls one way');
    assert.ok(night.interiorX < 0, 'a negative gradient curls the other');
    // HW9 P3 turns on the day case being the larger of the two.
    assert.ok(Math.abs(day.interiorX) > Math.abs(night.interiorX),
      'the daytime gradient is the larger one, as Huang describes');
  }
});

test('the axle spectrum drives a meaningful PCA damage summation', () => {
  const dmg = [];
  for (const b of cohort(25, '9970')) {
    const trucks = b.hw9.design.trucksPerDay * 365 * b.hw9.design.designPeriod;
    const groups = b.hw9.axles.map(g => ({
      load: g.load, type: g.type, reps: (g.reps / 1000) * trucks,
    }));
    const res = pcaAnalyze(groups, {
      // Representative table reads; the student supplies their own.
      equivalentStress: { single: 210, tandem: 190 },
      erosionFactor: { single: 2.62, tandem: 2.75 },
      modulusOfRupture: b.hw9.slab.modulusOfRupture,
      lsf: b.hw9.design.lsf,
      c1: b.hw9.design.c1,
      c2: b.hw9.design.tiedShoulder ? 0.94 : 0.06,
    });
    assert.ok(Number.isFinite(res.fatigueTotal) && Number.isFinite(res.erosionTotal),
      'both damage sums are real numbers');
    assert.ok(['fatigue', 'erosion'].includes(res.governing), 'a criterion governs');
    dmg.push({ f: res.fatigueTotal, e: res.erosionTotal, gov: res.governing });
  }
  // The summation has to discriminate: some real damage somewhere, and both
  // criteria should govern for somebody. If erosion always won, HW9 P4's
  // "report whether fatigue or erosion governs" would have one answer.
  assert.ok(dmg.some(x => x.f > 0.01 || x.e > 0.01), 'some spectra do real damage');
  // HW9 P4 asks which criterion governs. If the generator made one of them win
  // every time, that question would have a single class-wide answer a student
  // could get from a neighbor without doing the work.
  const govs = dmg.map(x => x.gov);
  assert.ok(govs.includes('fatigue'), 'fatigue governs for somebody');
  assert.ok(govs.includes('erosion'), 'erosion governs for somebody');
});

test('the axle spectrum is not a single spike', () => {
  const b = studentBundle('997000001', SALT, null);
  const singles = b.hw9.axles.filter(g => g.type === 'single');
  const total = singles.reduce((s, g) => s + g.reps, 0);
  const peak = Math.max(...singles.map(g => g.reps));
  assert.ok(peak < 0.75 * total, 'the load spectrum has spread');
  assert.ok(b.hw9.axles.every(g => g.reps > 0), 'no empty load groups');
});

/* ══════════════════ The new handouts carry no truth values ══════════════ */

test('every homework the redesign needs now has per-student data', () => {
  const files = studentFiles(studentBundle('991000001', SALT, basin));
  for (const name of [
    'hw2-resilient-modulus.csv', 'hw2-cbr.csv',
    'hw5-w4-table.csv', 'hw6-drainage-site.csv',
    'hw8-idot-scenario.csv', 'hw9-rigid-slab.csv',
    'hw9-axle-distribution.csv', 'hw10-fwd-survey.csv',
    'assignments.csv',
  ]) {
    assert.ok(files[name], `missing ${name}`);
    assert.ok(files[name].split('\n').length > 3, `${name} looks empty`);
  }
});

test('the new handouts do not label a pass/fail verdict', () => {
  // The filter verdict is the student's to compute, not ours to hand over.
  for (const uin of ['992000001', '992000002', '992000003']) {
    const blob = Object.values(studentFiles(studentBundle(uin, SALT, basin))).join('\n');
    assert.ok(!/\bpass\b/i.test(blob), 'no pass/fail verdict in the handout');
    assert.ok(!/\bfail/i.test(blob), 'no pass/fail verdict in the handout');
    assert.ok(!/governing|critical case/i.test(blob), 'no governing-case answer in the handout');
  }
});
