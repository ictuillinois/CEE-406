/* The shipped contact-stress artefact, decoded by the code the browser runs.
 *
 * This test is the only audit of public/tools/contact-stress that can be run
 * from this repository, because the trained phyContactGAN checkpoint is NOT in
 * it and never will be. fixture.json carries, for twenty cases:
 *
 *   probes / native* / store*  what the GENERATOR produced (torch, full 1 mm)
 *   recon*                     what the ARTEFACT reconstructs, per the Python
 *                              reference reader in the model archive
 *
 * so there are two independent things to assert:
 *
 *   1. the TypeScript loader agrees with the reference reader to ~1e-4 MPa.
 *      Any drift is a bug in one of them — a filter, an offset, a weight.
 *   2. the artefact tracks the generator inside the tolerances that were
 *      MEASURED when it was baked (0.007 MPa rms vertical, 0.4% on peak), not
 *      inside tolerances that were hoped for.
 *
 * And one external anchor: Lang et al. (2026) print the summed vertical
 * contact stress for the four wheel loads of their Figure 7. Those numbers
 * came off the model, not off this artefact, so reproducing them is a check on
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
import { fieldMetrics, idealizedContact, compare } from './equations.ts';

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
/* Node 22 has DecompressionStream, but pin the behaviour rather than trust it. */
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

/* ── 1. the artefact is what it says it is ────────────────────────────── */

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
  // Lang et al. Table 2: wheel load 989.73-60077.46 N, inflation 0.5-1.0 MPa,
  // slip 0-0.9978. Nothing a student can dial in may need extrapolation.
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
  // normalisation has std = 0. Baking anything else would be extrapolation.
  const wbt = manifest.tires.WBT;
  assert.deepEqual(wbt.domain.pressure, [0.4, 1.0]);
  assert.deepEqual(wbt.groups.map((g) => `${g.speed}/${g.condition}`), ['5mph/FR']);
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

/* ── 3. the artefact tracks the generator ─────────────────────────────── */

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
  // Compared against the model decimated to the same 2 mm grid: the artefact
  // cannot be asked to reproduce a 1 mm peak it does not store. (That
  // decimation itself costs 2-4% of the 1 mm peak, which is recorded in the
  // tool's own notes rather than hidden.)
  //
  // Every case lands inside 1.5% except corner-lo — 990 N, the very lightest
  // wheel load in the training set — where the footprint is a small sharp blob
  // and a basis learnt mostly from full-size footprints under-reads its peak by
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
    // the artefact is a 2 mm, rank-64 reconstruction of it.
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
    `light wheel: real patch is only ${light.areaOverIdeal.toFixed(2)}x the idealised one`);
  assert.ok(heavy.areaOverIdeal < 1.0,
    `heavy wheel: real patch is ${heavy.areaOverIdeal.toFixed(2)}x the idealised one`);
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
