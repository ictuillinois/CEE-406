// The One-layer figure frames.
//
// A figure is normally checked by opening it, and these two cannot be: they
// are drawn by Plotly inside a `client:only` island, so `render.test.mjs`
// never reaches a line of them. That is exactly the gap `geometry.test.mjs`
// was written to close for gear3d's meshes, and the same answer works here —
// put the decisions in pure functions and assert the properties a correct
// figure has, rather than assert what it looks like.
//
// What is pinned: the rounding ladder, the deflection frame's shape, the two
// half-widths, the station grid, and — the one that would actually catch a
// regression a reader would see — that every preset the module ships is
// framed by its own numbers, solved with the real solver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FRAME_STOPS, frameTop, deflFrame, halfWidths, stations, isMirrorable, MILS,
} from './frames.ts';
import {
  oneLayerResponse, rigidPlateResponse, pointLoadResponse, superposeOneLayer,
} from './oneLayer.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = 61;                       // must match OneLayerModule
const MAX_CURVES = 6;

/* ══════════════════════════════════════════════════════════════════════════
   The frame rules
   ══════════════════════════════════════════════════════════════════════════ */

test('frameTop rounds up to a round number and never down', () => {
  for (const v of [0.7, 1, 3.2, 8.9, 12, 35.4, 50, 89.6, 100, 119.4, 1234]) {
    const t = frameTop(v);
    assert.ok(t >= v * (1 - 1e-12), `frameTop(${v}) = ${t} is below its own data`);
    const m = t / 10 ** Math.floor(Math.log10(t));
    assert.ok(FRAME_STOPS.some(x => Math.abs(x - m) < 1e-9),
      `frameTop(${v}) = ${t} is not on the ladder`);
  }
});

test('frameTop lands ON a stop rather than jumping past it', () => {
  // 0.3 / 0.1 is 2.9999999999999996; a strict compare takes 30 to 35.
  for (const stop of FRAME_STOPS) {
    for (const decade of [0.01, 0.1, 1, 10, 100]) {
      const v = stop * decade;
      assert.ok(Math.abs(frameTop(v) - v) < 1e-9 * v,
        `frameTop(${v}) should be itself, got ${frameTop(v)}`);
    }
  }
});

test('frameTop survives nonsense rather than returning it', () => {
  for (const v of [0, -5, NaN, Infinity]) assert.equal(frameTop(v), 1);
});

test('the deflection frame keeps zero visibly inside it', () => {
  for (const bot of [50, 60, 100, 120, 200]) {
    const [top, b] = deflFrame(bot);
    assert.equal(b, bot);
    assert.ok(top < 0, 'the zero line must sit below the top edge, not on it');
    assert.equal(top, -bot / 3);
  }
});

test('stress is drawn to half the reach deflection is, except for a pair', () => {
  const single = halfWidths(60, false);
  assert.equal(single.defl, 60);
  assert.equal(single.stress, 30);
  // A pair spans the reach itself: at half width the second circle is off it.
  const pair = halfWidths(35, true);
  assert.equal(pair.defl, 35);
  assert.equal(pair.stress, 35);
});

test('the stations straddle the load and put one exactly on the axis', () => {
  const rs = stations(60, SAMPLES);
  assert.equal(rs.length, 2 * SAMPLES - 1);
  assert.equal(rs[0], -60);
  assert.equal(rs.at(-1), 60);
  assert.equal(rs[SAMPLES - 1], 0, 'r = 0 must be a station, not a chord across it');
  for (let i = 1; i < rs.length; i++) {
    assert.ok(rs[i] > rs[i - 1], 'stations must increase');
  }
  // EXACTLY symmetric, not symmetric to a tolerance: the mirrored half of a
  // curve carries a y solved at r[N-1-i], and it is drawn at r[i]. Compared
  // with ===, not assert.equal, because the center station is 0 and its own
  // negation is -0 — the same number everywhere that matters here, and a
  // different one to SameValue.
  for (const rMax of [6, 25, 35, 48, 60]) {
    const g = stations(rMax, SAMPLES);
    for (let i = 0; i < g.length; i++) {
      assert.ok(g[i] === -g[g.length - 1 - i],
        `rMax ${rMax}: station ${i} (${g[i]}) is not the exact mirror of ${g[g.length - 1 - i]}`);
    }
  }
});

test('only a single load may be mirrored', () => {
  assert.equal(isMirrorable(false), true);
  assert.equal(isMirrorable(true), false);
});

/* ══════════════════════════════════════════════════════════════════════════
   The mirror is a reflection of the answer, not an assumption about it
   ══════════════════════════════════════════════════════════════════════════ */

test('the three single-load fields are functions of |r|, so half may be reused', () => {
  const zs = [1, 5, 20];
  for (const z of zs) {
    for (const r of [0.5, 3, 6, 17.25, 40]) {
      const cases = [
        ['flexible', oneLayerResponse(r, z, 90, 6, 10000, 0.3),
          oneLayerResponse(Math.abs(-r), z, 90, 6, 10000, 0.3)],
        ['rigid', rigidPlateResponse(r, z, 70.74, 6, 5600, 0.4),
          rigidPlateResponse(Math.abs(-r), z, 70.74, 6, 5600, 0.4)],
        ['point', pointLoadResponse(r, z, 9000, 10000, 0.5),
          pointLoadResponse(Math.abs(-r), z, 9000, 10000, 0.5)],
      ];
      for (const [name, a, b] of cases) {
        assert.equal(a.sigZ, b.sigZ, `${name} sigZ at r=${r}, z=${z}`);
        assert.equal(a.w, b.w, `${name} w at r=${r}, z=${z}`);
      }
    }
  }
});

test('a PAIR is not, which is why it is solved in full', () => {
  // At -r the far circle is r + s away; at +r it is |r - s|. A figure that
  // mirrored this would draw a symmetric gear that is not symmetric.
  const at = (x) => superposeOneLayer(
    [{ x: 0, y: 0 }, { x: 20, y: 0 }], { x, y: 0, z: 10 }, 50, 5, 10000, 0.5);
  const left = at(-8), right = at(8);
  assert.ok(left && right);
  const gap = Math.abs(left.sz - right.sz) / Math.abs(right.sz);
  assert.ok(gap > 0.05,
    `a pair must be lopsided about r = 0; got ${gap * 100}% between -8 and +8`);
});

/* ══════════════════════════════════════════════════════════════════════════
   Every shipped preset is framed by its own numbers
   ══════════════════════════════════════════════════════════════════════════ */

/** The presets, read out of the module rather than restated here — a copy
 *  would pass this test forever while the shipped table drifted. */
function presets() {
  const src = readFileSync(join(HERE, 'modules', 'OneLayerModule.tsx'), 'utf8');
  const block = src.slice(src.indexOf('const PRESETS: Preset[] = ['));
  const out = [];
  const re = /\{\s*\n\s*label: '([^']+)',[\s\S]*?\n\s*\}/g;
  let m;
  while ((m = re.exec(block)) && out.length < 12) {
    const body = m[0];
    const get = (k) => {
      const hit = body.match(new RegExp(`\\b${k}: '([^']*)'`))
        ?? body.match(new RegExp(`\\b${k}: ([-\\d.]+)`));
      return hit ? hit[1] : null;
    };
    if (get('depths') == null) break;
    out.push({
      label: m[1],
      kase: get('kase'),
      P: +get('P'), q: +get('q'), a: +get('a'), E: +get('E'), nu: +get('nu'),
      twin: /twin: true/.test(body), spacing: +get('spacing'),
      depths: get('depths').split(',').map(v => +v.trim()),
      rMax: +get('rMax'), wBot: +get('wBot'),
    });
  }
  return out;
}

/** The module's own field evaluator, in the same three branches. */
function fieldOf(p) {
  const superposed = p.kase === 'flexible' && p.twin;
  return (rr, zz) => {
    const rA = Math.abs(rr);
    if (p.kase === 'point') return pointLoadResponse(rA, zz, p.P, p.E, p.nu);
    if (p.kase === 'rigid') return rigidPlateResponse(rA, zz, p.q, p.a, p.E, p.nu);
    if (!superposed) return oneLayerResponse(rA, zz, p.q, p.a, p.E, p.nu);
    const S = superposeOneLayer(
      [{ x: 0, y: 0 }, { x: p.spacing, y: 0 }], { x: rr, y: 0, z: zz },
      p.q, p.a, p.E, p.nu);
    return S && { sigZ: S.sz, w: S.w };
  };
}

function curvesOf(p) {
  const superposed = p.kase === 'flexible' && p.twin;
  const rMax = Math.max(p.a * 1.5, p.rMax);
  const rs = stations(rMax, SAMPLES);
  const field = fieldOf(p);
  const depths = (p.kase === 'point' ? p.depths.filter(v => v > 0) : p.depths)
    .slice(0, MAX_CURVES);
  return { superposed, rMax, rs, curves: depths.map(z => ({
    z,
    sigZ: rs.map(r => { const R = field(r, z); return R && Number.isFinite(R.sigZ) ? R.sigZ : null; }),
    w: rs.map(r => { const R = field(r, z); return R && Number.isFinite(R.w) ? R.w * MILS : null; }),
  })) };
}

test('every preset parses, and there are six of them', () => {
  const ps = presets();
  assert.equal(ps.length, 6, 'the preset reader has lost track of the table');
  for (const p of ps) {
    assert.ok(p.wBot > 0, `${p.label} has no deflection frame`);
    assert.ok(p.rMax > 0 && p.depths.length > 0, p.label);
  }
});

test('the opening preset is the case the figures were specified for', () => {
  const p = presets()[4];
  assert.deepEqual(p.depths, [1, 5, 10, 15, 20, 30]);
  assert.equal(p.rMax, 60);
  assert.deepEqual(halfWidths(p.rMax, false), { stress: 30, defl: 60 });
  assert.deepEqual(deflFrame(p.wBot), [-20, 60]);

  // and its stress frame really does come out at 100 psi, from the solver
  const { curves } = curvesOf(p);
  let top = 0;
  for (const cv of curves) for (const v of cv.sigZ) if (v != null && v > top) top = v;
  assert.ok(Math.abs(top - 89.6) < 0.5, `peak sigma_z should be ~89.6 psi, got ${top}`);
  assert.equal(frameTop(top), 100);
});

test('each preset stress frame holds its own field, away from the rigid rim', () => {
  for (const p of presets()) {
    const { curves, rMax, rs } = curvesOf(p);
    let top = 0;
    for (const cv of curves) {
      for (let i = 0; i < rs.length; i++) {
        const v = cv.sigZ[i];
        if (v == null) continue;
        // Eq. 2.9 is unbounded at the rim, so the frame is taken off it and
        // the surface curve is left to run off the top. Same rule as the app.
        const rA = Math.abs(rs[i]);
        if (p.kase === 'rigid' && cv.z === 0 && rA > 0.9 * p.a && rA < 1.1 * p.a) continue;
        if (v > top) top = v;
      }
    }
    const frame = frameTop(top);
    assert.ok(frame >= top, `${p.label}: frame ${frame} below peak ${top}`);
    // and not absurdly generous — a frame more than 2x its own field is a
    // figure drawn in its top half
    assert.ok(frame <= top * 2,
      `${p.label}: frame ${frame} is more than twice its peak ${top}`);
    assert.ok(halfWidths(rMax, p.kase === 'flexible' && p.twin).defl === rMax);
  }
});

test('only the opening study clips, and it clips exactly the curves it names', () => {
  // A fixed frame that hides something must say what. The module prints the
  // offending depths under the figure; this asserts that list is the truth,
  // and that no OTHER preset silently loses a curve off its own frame.
  const expected = {
    'Plate study: E = 5k – 40k': [1, 5],
  };
  for (const p of presets()) {
    const { curves } = curvesOf(p);
    const [top, bot] = deflFrame(p.wBot);
    const off = [];
    for (const cv of curves) {
      if (cv.w.some(v => v != null && (v > bot || v < top))) off.push(cv.z);
    }
    assert.deepEqual(off, expected[p.label] ?? [],
      `${p.label}: curves leaving the deflection frame`);
  }
});
