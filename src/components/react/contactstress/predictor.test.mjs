/* The shipped contact-stress artifact, decoded by the code the browser runs.
 *
 * This test is the only audit of public/tools/contact-stress that can be run
 * from this repository, because the trained phyContactGAN checkpoint is NOT in
 * it and never will be. fixture.json carries, for twenty cases:
 *
 *   probes / native* / store*  what the GENERATOR produced (torch, full 1 mm)
 *   recon*                     what the ARTIFACT reconstructs, per the Python
 *                              reference reader in the model archive
 *
 * so there are two independent things to assert:
 *
 *   1. the TypeScript loader agrees with the reference reader to ~1e-4 MPa.
 *      Any drift is a bug in one of them — a filter, an offset, a weight.
 *   2. the artifact tracks the generator inside the tolerances that were
 *      MEASURED when it was baked (0.007 MPa rms vertical, 0.4% on peak), not
 *      inside tolerances that were hoped for.
 *
 * And one external anchor: Lang et al. (2026) print the summed vertical
 * contact stress for the four wheel loads of their Figure 7. Those numbers
 * came off the model, not off this artifact, so reproducing them is a check on
 * the whole chain.
 *
 * Run:  node --experimental-strip-types --test src/components/react/contactstress/predictor.test.mjs
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadManifest, loadTire, predict, cubicWeights, CHANNELS } from './predictor.ts';
import {
  fieldMetrics, idealizedContact, compare,
  SAFE_RANGE, SLIP_RANGE, EQUILIBRIUM_BAND, TENSION_LIMIT, PRESETS,
  TRAINED_ENVELOPE, trainedBox,
  FIELD_RANGE, profileRange, divergingLimit, shearLimit,
} from './equations.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const ART = join(ROOT, 'public', 'tools', 'contact-stress');
const fixture = JSON.parse(readFileSync(join(HERE, 'fixture.json'), 'utf8'));

/* The loader fetches. Serve the two files off disk, and gunzip here so the
   fetch mock hands back exactly what a browser would receive over the wire. */
globalThis.fetch = async (url) => {
  const name = String(url).split('/').pop();
  const buf = readFileSync(join(ART, name));
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};
/* Node 22 has DecompressionStream, but pin the behavior rather than trust it. */
globalThis.Blob ??= (await import('node:buffer')).Blob;
globalThis.Response ??= (await import('node:buffer')).Blob && globalThis.Response;

let manifest;
const packs = {};

before(async () => {
  manifest = await loadManifest('/');
  for (const tire of ['DTA', 'WBT']) packs[tire] = await loadTire('/', manifest, tire);
});

const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}, |diff| ${Math.abs(a - b)} > ${tol}`);

/* ── 1. the artifact is what it says it is ────────────────────────────── */

test('the manifest names its source and never claims to ship the model', () => {
  assert.match(manifest.source.doi, /^10\.1080\/10298436\.2026\.2621970$/);
  assert.match(manifest.source.citation, /Lang, H\..*Villamil.*Al-Qadi/);
  assert.match(manifest.source.note, /weights are not distributed/);
  assert.equal(manifest.interpolation, 'cubic4');
  assert.deepEqual(manifest.channels, ['vertical', 'longitudinal', 'transverse']);
});

test('nothing in public/tools/contact-stress is a checkpoint', () => {
  for (const t of ['dta', 'wbt']) {
    const raw = readFileSync(join(ART, `${t}.bin`));
    assert.equal(raw[0], 0x1f, `${t}.bin should be gzip`);
    assert.equal(raw[1], 0x8b, `${t}.bin should be gzip`);
    // A 33-million-parameter generator is ~135 MB. Anything near that means
    // somebody put the wrong file here.
    assert.ok(raw.length < 8e6, `${t}.bin is ${raw.length} bytes — too big to be a PCA basis`);
    // The decompressed size must match the byte budget the manifest declares,
    // which is what every section offset is computed against.
    assert.equal(gunzipSync(raw).length, manifest.tires[t.toUpperCase()].bytes);
  }
});

test('the grid covers the whole training domain of each branch', () => {
  const dta = manifest.tires.DTA;
  // The manifest's `domain` is the UNION over the branch, taken from the
  // min/max columns of the checkpoint's normalization table. It is what the
  // grid has to span so that no baked node is an extrapolation of the model.
  // It is NOT the box the sliders may span — see the envelope test below,
  // which is the thing this used to be read as saying.
  near(dta.domain.load[0], 989.7295, 0.01, 'DTA min load');
  near(dta.domain.load[1], 60077.4648, 0.01, 'DTA max load');
  assert.deepEqual(dta.domain.pressure, [0.5, 1.0]);
  assert.equal(dta.domain.slip[1], 1.0);
  assert.equal(dta.groups.length, 6, 'two speeds x three rolling conditions');
  for (const g of dta.groups) {
    assert.equal(g.slips.length, g.condition === 'FR' ? 1 : 12,
      'free rolling is slip = 0 by definition');
  }
  // The WBT branch was trained free-rolling at one speed only; its slip
  // normalization has std = 0. Baking anything else would be extrapolation.
  const wbt = manifest.tires.WBT;
  assert.deepEqual(wbt.domain.pressure, [0.4, 1.0]);
  assert.deepEqual(wbt.groups.map((g) => `${g.speed}/${g.condition}`), ['5mph/FR']);
});

test('TRAINED_ENVELOPE names every block the artifact bakes, and unions to the manifest', () => {
  /* The envelope table is the per-block truth the manifest cannot carry, and
     it is hand-transcribed from the feature matrix shipped with the weights.
     Two things tie it to the artifact so it cannot silently go stale:
     it must name exactly the blocks that were baked, and its union must be
     the rectangle the manifest reports. A re-bake that adds a block, or that
     widens the domain, fails here rather than in a student's browser. */
  for (const [tire, spec] of Object.entries(manifest.tires)) {
    const baked = spec.groups.map((g) => `${g.speed}|${g.condition}`).sort();
    assert.deepEqual(Object.keys(TRAINED_ENVELOPE[tire]).sort(), baked,
      `${tire}: the envelope table and the baked blocks disagree`);
    const all = Object.values(TRAINED_ENVELOPE[tire]);
    near(Math.min(...all.map((e) => e.load[0])), spec.domain.load[0], 0.01, `${tire} union load lo`);
    near(Math.max(...all.map((e) => e.load[1])), spec.domain.load[1], 0.01, `${tire} union load hi`);
    near(Math.min(...all.map((e) => e.pressure[0])), spec.domain.pressure[0], 1e-9, `${tire} union pressure lo`);
    near(Math.max(...all.map((e) => e.pressure[1])), spec.domain.pressure[1], 1e-9, `${tire} union pressure hi`);
    // The manifest rounds the slip ceiling to 1; the database stops at 0.9978.
    assert.ok(Math.max(...all.map((e) => e.slip[1])) <= spec.domain.slip[1] + 1e-9,
      `${tire}: the envelope claims more slip than the grid spans`);
  }
  // And the slip slider stops at the smallest ceiling any block with slip has.
  assert.deepEqual(SLIP_RANGE, [0, trainedBox('DTA').slip[1]]);
  assert.equal(SLIP_RANGE[1], 0.99);
});

test('the stored grid is 2 mm and maps onto the model footprint', () => {
  for (const [tire, t] of Object.entries(manifest.tires)) {
    near(t.mmPerPixelY, t.nativeHeight / t.height, 1e-9, `${tire} dy`);
    near(t.mmPerPixelX, t.nativeWidth / t.width, 1e-9, `${tire} dx`);
    assert.ok(t.mmPerPixelY <= 2.01 && t.mmPerPixelX <= 2.01, `${tire} is coarser than 2 mm`);
    assert.equal(t.nativeWidth, 321, 'longitudinal extent is 321 mm (Lang et al. §"Data preprocessing")');
  }
  assert.equal(manifest.tires.DTA.nativeHeight, 224);
  assert.equal(manifest.tires.WBT.nativeHeight, 391);
});

/* ── 2. the loader agrees with the reference reader ───────────────────── */

test('every probe matches the Python reference reader', () => {
  let worst = 0;
  for (const c of fixture.cases) {
    const t = manifest.tires[c.tire];
    const rows = fixture.probeRows[c.tire];
    const cols = fixture.probeCols[c.tire];
    const idx = rows.flatMap((r) => cols.map((col) => r * t.width + col));
    for (const ch of CHANNELS) {
      const f = predict(packs[c.tire], ch, c);
      c.channels[ch].reconProbes.forEach((expected, i) => {
        worst = Math.max(worst, Math.abs(f[idx[i]] - expected));
      });
    }
  }
  // float32 accumulation in the browser against float64 in numpy over up to 64
  // basis terms. Anything above this is a real disagreement, not rounding.
  assert.ok(worst < 2e-4, `worst TS-vs-Python probe difference ${worst} MPa`);
});

test('field extrema and the resultant match the reference reader', () => {
  for (const c of fixture.cases) {
    const t = manifest.tires[c.tire];
    const cell = t.mmPerPixelX * t.mmPerPixelY;
    for (const ch of CHANNELS) {
      const f = predict(packs[c.tire], ch, c);
      const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
      const r = c.channels[ch];
      near(m.peak, r.reconMax, 3e-4, `${c.name}/${ch} max`);
      near(m.min, r.reconMin, 3e-4, `${c.name}/${ch} min`);
      near(m.resultant, r.reconSum, Math.abs(r.reconSum) * 2e-5 + 0.5, `${c.name}/${ch} resultant`);
      assert.equal(f.length, t.height * t.width);
      assert.ok(Number.isFinite(m.peak) && Number.isFinite(m.min), `${c.name}/${ch} not finite`);
      void cell;
    }
  }
});

test('cubic weights are a partition of unity and reproduce the nodes', () => {
  const axis = manifest.tires.DTA.loads;
  for (const x of [axis[0], 1234, 20000, 45678, axis[axis.length - 1]]) {
    const w = cubicWeights(axis, x);
    near(w.reduce((s, e) => s + e.w, 0), 1, 1e-9, `weights sum at ${x}`);
    near(w.reduce((s, e) => s + e.w * axis[e.i], 0), x, 1e-6, `weights reproduce x at ${x}`);
  }
  // On a node, the interpolant must be the node itself.
  for (let i = 0; i < axis.length; i++) {
    const w = cubicWeights(axis, axis[i]);
    const hit = w.find((e) => e.i === i);
    near(hit ? hit.w : 0, 1, 1e-9, `node ${i} weight`);
  }
  // A single-point axis (free rolling) collapses to a constant.
  assert.deepEqual(cubicWeights([0], 0.4), [{ i: 0, w: 1 }]);
});

/* ── 3. the artifact tracks the generator ─────────────────────────────── */

test('reconstruction tracks the generator within the measured tolerance', () => {
  const tol = { vertical: 0.045, longitudinal: 0.03, transverse: 0.02 };
  const worst = { vertical: 0, longitudinal: 0, transverse: 0 };
  for (const c of fixture.cases) {
    const t = manifest.tires[c.tire];
    const rows = fixture.probeRows[c.tire];
    const cols = fixture.probeCols[c.tire];
    const idx = rows.flatMap((r) => cols.map((col) => r * t.width + col));
    for (const ch of CHANNELS) {
      const f = predict(packs[c.tire], ch, c);
      c.channels[ch].probes.forEach((truth, i) => {
        worst[ch] = Math.max(worst[ch], Math.abs(f[idx[i]] - truth));
      });
    }
  }
  for (const ch of CHANNELS) {
    assert.ok(worst[ch] <= tol[ch],
      `${ch}: worst probe error ${worst[ch].toFixed(4)} MPa exceeds ${tol[ch]} MPa`);
  }
});

test('peak vertical stress tracks the generator, and the one place it does not', () => {
  // Compared against the model decimated to the same 2 mm grid: the artifact
  // cannot be asked to reproduce a 1 mm peak it does not store. (That
  // decimation itself costs 2-4% of the 1 mm peak, which is recorded in the
  // tool's own notes rather than hidden.)
  //
  // Every case lands inside 1.5% except corner-lo — 990 N, the very lightest
  // wheel load in the training set — where the footprint is a small sharp blob
  // and a basis learned mostly from full-size footprints under-reads its peak by
  // 4.4%. It is also where the model's own equilibrium closure is worst (~1.38),
  // so the tool warns below 3 kN rather than pretending the corner is solid.
  const loose = new Set(['corner-lo']);
  for (const c of fixture.cases) {
    const t = manifest.tires[c.tire];
    const f = predict(packs[c.tire], 'vertical', c);
    const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
    const ratio = m.peak / c.channels.vertical.storeMax;
    near(ratio, 1, loose.has(c.name) ? 0.05 : 0.015, `${c.name} peak ratio`);
  }
});

/* ── 4. the paper's own printed numbers ───────────────────────────────── */

test("Figure 7 of Lang et al. (2026): the printed summed vertical stresses", () => {
  // "The total vertical contact stress values (5276.8, 12405.3, 18756.7, and
  // 39595.6 MPa) demonstrate consistency with static equilibrium" — for wheel
  // loads of 5, 12.51, 20.19 and 45.43 kN at 0.70 MPa, free rolling, 8 km/h.
  // The sum is over 1 mm cells, so it is numerically the resultant in newtons.
  const printed = {
    'fig7-5kN': 5276.8,
    'fig7-12.51kN': 12405.3,
    'fig7-20.19kN': 18756.7,
    'fig7-45.43kN': 39595.6,
  };
  for (const [name, expected] of Object.entries(printed)) {
    const c = fixture.cases.find((x) => x.name === name);
    const t = manifest.tires[c.tire];
    const f = predict(packs[c.tire], 'vertical', c);
    const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
    // 1.5% covers the two things between us and the printed value: this
    // checkpoint is not bit-identical to the one that produced the table, and
    // the artifact is a 2 mm, rank-64 reconstruction of it.
    near(m.resultant / expected, 1, 0.015, `${name} resultant vs printed`);
  }
});

test('the surrogate keeps vertical equilibrium and does not pull on the pavement', () => {
  for (const c of fixture.cases) {
    if (c.tire !== 'DTA') continue;
    const t = manifest.tires[c.tire];
    const f = predict(packs[c.tire], 'vertical', c);
    const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
    const cmp = compare(m, idealizedContact(c.load, c.pressure), c.load);
    // Equation 5 of the paper drives this to 1 through the physics loss. It
    // gets to within ~15% at the extremes of the load range, which is exactly
    // why the tool reports it instead of hiding it.
    assert.ok(cmp.equilibrium > 0.75 && cmp.equilibrium < 1.45,
      `${c.name}: equilibrium closure ${cmp.equilibrium.toFixed(3)} is outside anything defensible`);
    assert.ok(cmp.tension < 0.35,
      `${c.name}: tensile vertical stress is ${(cmp.tension * 100).toFixed(1)}% of peak`);
  }
});

test('contact area and inflation pressure disagree, and by a load-dependent amount', () => {
  // The teaching claim the tool makes, asserted rather than asserted-in-prose:
  // at light load the real patch is much larger than P/p (so mean contact
  // pressure is well below the inflation pressure) and at heavy load it is
  // smaller. Huang §1.3 says the assumption is "on the safe side"; that is
  // true at the heavy end and not at the light one.
  const t = manifest.tires.DTA;
  const at = (load) => {
    const f = predict(packs.DTA, 'vertical', {
      tire: 'DTA', load, pressure: 0.7, slip: 0, speed: '5mph', condition: 'FR',
    });
    const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
    return compare(m, idealizedContact(load, 0.7), load);
  };
  const light = at(6000);
  const heavy = at(55000);
  assert.ok(light.areaOverIdeal > 1.4,
    `light wheel: real patch is only ${light.areaOverIdeal.toFixed(2)}x the idealized one`);
  assert.ok(heavy.areaOverIdeal < 1.0,
    `heavy wheel: real patch is ${heavy.areaOverIdeal.toFixed(2)}x the idealized one`);
  assert.ok(light.meanOverInflation < heavy.meanOverInflation,
    'mean contact pressure must rise relative to inflation pressure as the wheel is loaded');
  assert.ok(heavy.peakOverInflation > 2,
    `peak contact stress at 55 kN is only ${heavy.peakOverInflation.toFixed(2)}x inflation pressure`);
});

test('braking and acceleration flip the sign of the longitudinal field', () => {
  // Lang et al. Figure 8: at 42 kN, 0.69 MPa, 8 km/h, braking puts the tread
  // into positive longitudinal stress and acceleration into negative.
  const t = manifest.tires.DTA;
  const run = (condition, slip) => {
    const f = predict(packs.DTA, 'longitudinal', {
      tire: 'DTA', load: 42000, pressure: 0.69, slip, speed: '5mph', condition,
    });
    return fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
  };
  const brake = run('Brake', 0.07);
  const acc = run('Acc', 0.07);
  const free = run('FR', 0);
  assert.ok(brake.peak > 0.35, `braking peak ${brake.peak.toFixed(3)} MPa`);
  assert.ok(acc.min < -0.35, `acceleration minimum ${acc.min.toFixed(3)} MPa`);
  assert.ok(Math.abs(free.peak) < brake.peak && Math.abs(free.min) < Math.abs(acc.min),
    'free rolling should be the mildest of the three');
  assert.ok(brake.resultant > 0 && acc.resultant < 0,
    'the longitudinal resultant is the friction force, and it reverses');
});

/* ── 4. the sliders cannot reach a prediction that does not close ─────── */

/* SAFE_RANGE is the box the two sliders span, and it exists so that nothing a
   student can reach fails either residual check — the tool used to hand out
   three different warnings at the corners of the training domain. The box was
   chosen by sweeping THIS artifact, so it is only as good as the artifact:
   re-bake the payload without re-sweeping and this is what says so.

   The box was derived from a 159,073-prediction sweep at slider resolution
   (load 250 N, pressure 0.005 MPa, eighteen rolling controls), which measured
   the worst residual anywhere reachable as equilibrium 0.8555 / 1.1367 and
   tension 0.0970. That sweep takes about half an hour, so it is not what runs
   here: this is a coarser grid over the same box, on the conditions that
   carried those worst cases. It is a regression gate, not the derivation. */
test('no warning is reachable anywhere the sliders go', () => {
  const CONDS = {
    DTA: [['FR', '5mph', 0], ['FR', '70mph', 0],
      ['Acc', '70mph', SLIP_RANGE[1]], ['Acc', '5mph', 0.07438],
      ['Brake', '70mph', SLIP_RANGE[1]], ['Brake', '5mph', SLIP_RANGE[1]]],
    WBT: [['FR', '5mph', 0]],
  };
  for (const tire of ['DTA', 'WBT']) {
    const t = manifest.tires[tire];
    const box = SAFE_RANGE[tire];
    /* Against the INTERSECTION of the blocks, not the manifest's union. The
       union is what the artifact bakes; the intersection is what every rolling
       condition the tool offers was actually simulated over. Checking the
       union is what let the pressure slider reach 1.0 MPa under braking, where
       the FE database has no case at any load or speed. */
    const env = trainedBox(tire);
    assert.ok(box.load[0] >= env.load[0] && box.load[1] <= env.load[1],
      `${tire}: the load slider leaves the training envelope ${JSON.stringify(env.load)}`);
    assert.ok(box.pressure[0] >= env.pressure[0] && box.pressure[1] <= env.pressure[1],
      `${tire}: the pressure slider leaves the training envelope ${JSON.stringify(env.pressure)}`);

    for (let l = box.load[0]; l <= box.load[1] + 1; l += 1000) {
      const load = Math.min(l, box.load[1]);
      for (let q = box.pressure[0]; q <= box.pressure[1] + 1e-9; q += 0.02) {
        const pressure = Math.min(q, box.pressure[1]);
        for (const [condition, speed, slip] of CONDS[tire]) {
          const f = predict(packs[tire], 'vertical',
            { tire, load, pressure, slip: condition === 'FR' ? 0 : slip, speed, condition });
          const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
          const c = compare(m, idealizedContact(load, pressure), load);
          const at = `${tire} at ${(load / 1000).toFixed(2)} kN, ${pressure.toFixed(3)} MPa, ${speed}/${condition} slip ${slip}`;
          assert.ok(c.equilibrium >= EQUILIBRIUM_BAND[0] && c.equilibrium <= EQUILIBRIUM_BAND[1],
            `${at}: equilibrium ${c.equilibrium.toFixed(4)} is outside ${JSON.stringify(EQUILIBRIUM_BAND)} — the tool would warn`);
          assert.ok(c.tension <= TENSION_LIMIT,
            `${at}: tensile fraction ${c.tension.toFixed(4)} exceeds ${TENSION_LIMIT} — the tool would warn`);
        }
      }
    }
  }
});

/* FIELD_RANGE is the fixed color scale, and it has exactly one failure mode
   that matters: a field that runs off the end of it. Plotly does not complain
   about that — it clamps to the top color and says nothing, so the figure goes
   on looking plausible while the peak is a lie. This is what says so instead.

   Like SAFE_RANGE above, the constant was derived by a long sweep that does
   not run here: scripts/contact-stress-range.mjs, 163,125 field
   reconstructions over the whole admissible box crossed with every rolling
   control. This is the coarse regression gate over the same space. Re-bake the
   artifact without re-running the script and this is what catches it. */
test('no field the controls can reach runs off the fixed color scale', () => {
  const ROLLING = {
    DTA: (() => {
      const out = [];
      for (const speed of ['5mph', '70mph']) {
        out.push(['FR', speed, 0]);
        for (const condition of ['Brake', 'Acc']) {
          for (let i = 0; i <= 4; i++) out.push([condition, speed, (SLIP_RANGE[1] * i) / 4]);
        }
      }
      return out;
    })(),
    WBT: [['FR', '5mph', 0]],
  };

  for (const tire of ['DTA', 'WBT']) {
    const box = SAFE_RANGE[tire];
    // Track how much of each scale is actually used: a scale nothing reaches
    // the top of wastes contrast, which is the other way to get this wrong.
    const reach = { vertical: 0, longitudinal: 0, transverse: 0 };

    for (let i = 0; i <= 4; i++) {
      const load = box.load[0] + ((box.load[1] - box.load[0]) * i) / 4;
      for (let j = 0; j <= 4; j++) {
        const pressure = box.pressure[0] + ((box.pressure[1] - box.pressure[0]) * j) / 4;
        for (const [condition, speed, slip] of ROLLING[tire]) {
          const inp = { tire, load, pressure, slip: condition === 'FR' ? 0 : slip, speed, condition };
          const at = `${tire} at ${(load / 1000).toFixed(1)} kN, ${pressure.toFixed(3)} MPa, ${speed}/${condition} slip ${slip}`;
          for (const ch of CHANNELS) {
            const f = predict(packs[tire], ch, inp);
            let lo = Infinity;
            let hi = -Infinity;
            for (let k = 0; k < f.length; k++) {
              if (f[k] < lo) lo = f[k];
              if (f[k] > hi) hi = f[k];
            }
            const r = FIELD_RANGE[tire][ch];
            assert.ok(hi <= r.hi, `${at}: ${ch} peaks at ${hi.toFixed(4)}, above the ${r.hi} scale top — Plotly would clamp it silently`);
            assert.ok(lo >= r.lo, `${at}: ${ch} dips to ${lo.toFixed(4)}, below the ${r.lo} scale floor`);
            reach[ch] = Math.max(reach[ch], Math.abs(hi), Math.abs(lo));
          }
        }
      }
    }

    for (const ch of CHANNELS) {
      const span = Math.max(Math.abs(FIELD_RANGE[tire][ch].lo), FIELD_RANGE[tire][ch].hi);
      const used = reach[ch] / span;
      // Vertical is shared with the other tire on purpose, so the wide-base
      // branch only reaches about half of it — that IS the comparison. Nothing
      // may fall under a third, which is where a ramp stops reading.
      assert.ok(used > 0.33,
        `${tire} ${ch} only reaches ${(used * 100).toFixed(0)}% of its scale — too loose to read`);
    }
  }
});

test('the shear scales are symmetric, and the profile range covers every channel', () => {
  for (const tire of ['DTA', 'WBT']) {
    for (const ch of ['longitudinal', 'transverse']) {
      const { lo, hi } = FIELD_RANGE[tire][ch];
      // chartTheme's diverging scale puts the surface color at its midpoint;
      // an asymmetric range moves zero off that stop and makes one sign louder.
      assert.equal(-lo, hi, `${tire} ${ch} diverging range is not symmetric about zero`);
      assert.equal(divergingLimit(tire, ch), hi);
    }
    const [plo, phi] = profileRange(tire);
    for (const ch of CHANNELS) {
      assert.ok(plo <= FIELD_RANGE[tire][ch].lo, `${tire} profile range clips ${ch} below`);
      assert.ok(phi >= FIELD_RANGE[tire][ch].hi, `${tire} profile range clips ${ch} above`);
    }
  }
  // The vertical scale is shared so the two tires can be read against each
  // other; if that ever stops being true, the comparison silently breaks.
  assert.equal(FIELD_RANGE.DTA.vertical.hi, FIELD_RANGE.WBT.vertical.hi,
    'the vertical scale is meant to be shared by both tires');
  assert.equal(FIELD_RANGE.DTA.transverse.hi, FIELD_RANGE.WBT.transverse.hi,
    'the transverse scale is meant to be shared by both tires');
});

/* The two shear windows are the one thing in this tool that scales itself to
   its own data, and it has the same silent failure mode the fixed scale has:
   a limit that does not cover the field, which Plotly clamps without a word.
   This re-derives the limit the way the component does — from the field's own
   extrema — over the whole box, and checks both halves of the bargain: the
   limit never clips, and it never leaves so much headroom that the surface is
   flat again, which is the reason for the change in the first place. */
test('the adaptive shear scale covers each field and does not leave it flat', () => {
  const ROLLING = {
    DTA: [['FR', '5mph', 0], ['FR', '70mph', 0],
      ['Brake', '5mph', 0.07438], ['Brake', '5mph', SLIP_RANGE[1]],
      ['Acc', '70mph', 0.07438], ['Acc', '70mph', SLIP_RANGE[1]]],
    WBT: [['FR', '5mph', 0]],
  };
  // What the FIXED scale would have shown, for the record: the smallest
  // fraction of it any reachable case reaches. This is the defect the adaptive
  // scale is for, so it is recorded rather than described.
  const worstFixed = { DTA: Infinity, WBT: Infinity };

  for (const tire of ['DTA', 'WBT']) {
    const t = manifest.tires[tire];
    const box = SAFE_RANGE[tire];
    for (let i = 0; i <= 3; i++) {
      const load = box.load[0] + ((box.load[1] - box.load[0]) * i) / 3;
      for (let j = 0; j <= 3; j++) {
        const pressure = box.pressure[0] + ((box.pressure[1] - box.pressure[0]) * j) / 3;
        for (const [condition, speed, slip] of ROLLING[tire]) {
          const inp = { tire, load, pressure, slip: condition === 'FR' ? 0 : slip, speed, condition };
          for (const ch of ['longitudinal', 'transverse']) {
            const f = predict(packs[tire], ch, inp);
            const m = fieldMetrics(f, t.height, t.width, t.mmPerPixelY, t.mmPerPixelX);
            const lim = shearLimit(m.min, m.peak);
            const reach = Math.max(Math.abs(m.min), m.peak);
            const at = `${tire} ${ch} at ${(load / 1000).toFixed(1)} kN, ${pressure.toFixed(3)} MPa, ${speed}/${condition} slip ${slip}`;
            assert.ok(lim >= reach - 1e-12,
              `${at}: field reaches ${reach.toFixed(4)} MPa, above the ±${lim} it is drawn on`);
            // The ladder's widest gap is 25%, so a field must fill at least
            // 1/1.25 of its own scale unless SHEAR_FLOOR is what is binding.
            assert.ok(reach / lim >= 0.8 || lim === 0.02,
              `${at}: fills only ${((reach / lim) * 100).toFixed(0)}% of ±${lim}`);
            worstFixed[tire] = Math.min(worstFixed[tire], reach / divergingLimit(tire, ch));
          }
        }
      }
    }
  }
  // On the fixed scale some reachable case was down at a few percent of the
  // ramp — a flat sheet in the neutral color, and flat in height too, because
  // the z axis took the same limit. If this ever stops being true the adaptive
  // scale has stopped earning its exception and should go back to fixed.
  assert.ok(worstFixed.DTA < 0.1,
    `the fixed DTA shear scale is reached to ${(worstFixed.DTA * 100).toFixed(0)}% at worst — it no longer needs replacing`);
});

test('every preset lands inside the box its tire offers', () => {
  // A preset outside SAFE_RANGE is silently clamped, and then no longer is the
  // printed case it is named after. Four of these are figures in Lang et al.
  // (2026) and the tool is calibrated against them.
  assert.ok(PRESETS.length >= 7, 'presets have gone missing');
  for (const p of PRESETS) {
    const b = SAFE_RANGE[p.inp.tire];
    assert.ok(p.inp.load >= b.load[0] && p.inp.load <= b.load[1],
      `${p.name}: ${p.inp.load} N is outside the ${p.inp.tire} load slider ${JSON.stringify(b.load)}`);
    assert.ok(p.inp.pressure >= b.pressure[0] && p.inp.pressure <= b.pressure[1],
      `${p.name}: ${p.inp.pressure} MPa is outside the ${p.inp.tire} pressure slider ${JSON.stringify(b.pressure)}`);
  }
});
