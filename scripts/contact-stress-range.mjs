/* Derive the fixed color scale for the Contact Stress Visualizer.
   ------------------------------------------------------------------
   The tool used to rescale every field to its own peak, which meant the
   colors said nothing about magnitude: a rib at 0.9 MPa and the same rib at
   2.0 MPa were painted the identical orange, and moving the load slider
   changed the numbers on the legend while the picture held still. The point
   of the card is the opposite of that.

   So the scale is fixed, and this is what fixes it: a sweep of the SHIPPED
   artifact over everything the controls can reach, recording the extreme of
   each channel. The constant it prints goes into FIELD_RANGE in equations.ts,
   rounded UP so the scale ends on a number a student can read and so there is
   headroom against interpolation between grid points. predictor.test.mjs
   re-runs a coarser version of this and fails if the artifact ever outgrows
   the constant — re-bake the payload without re-deriving, and that is what
   says so.

       node --experimental-strip-types scripts/contact-stress-range.mjs
       node --experimental-strip-types scripts/contact-stress-range.mjs --fine

   Takes about a minute coarse, ten or so fine.
   ================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ART = join(ROOT, 'public', 'tools', 'contact-stress');

globalThis.fetch = async (url) => {
  const buf = readFileSync(join(ART, String(url).split('/').pop()));
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};

const { loadManifest, loadTire, predict, CHANNELS } = await import(
  '../src/components/react/contactstress/predictor.ts'
);
const { SAFE_RANGE } = await import('../src/components/react/contactstress/equations.ts');

const fine = process.argv.includes('--fine');

/* Every rolling state the controls can actually reach. The wide-base branch
   was trained free rolling at 8 km/h only and the UI disables the rest of the
   row for it, so its reachable set is a single point. Free rolling pins slip
   to zero by definition — the component does the same. */
function rollingStates(tire) {
  if (tire === 'WBT') return [{ condition: 'FR', speed: '5mph', slip: 0 }];
  const out = [];
  for (const speed of ['5mph', '70mph']) {
    out.push({ condition: 'FR', speed, slip: 0 });
    const steps = fine ? 20 : 8;
    for (const condition of ['Brake', 'Acc']) {
      for (let i = 0; i <= steps; i++) out.push({ condition, speed, slip: i / steps });
    }
  }
  return out;
}

const manifest = await loadManifest('/');
const report = {};

for (const tire of ['DTA', 'WBT']) {
  const pack = await loadTire('/', manifest, tire);
  const box = SAFE_RANGE[tire];
  const states = rollingStates(tire);
  const nL = fine ? 24 : 10;
  const nP = fine ? 24 : 10;

  const ext = {};
  const argmax = {};
  for (const ch of CHANNELS) ext[ch] = { min: Infinity, max: -Infinity };

  let n = 0;
  for (let i = 0; i <= nL; i++) {
    const load = box.load[0] + ((box.load[1] - box.load[0]) * i) / nL;
    for (let j = 0; j <= nP; j++) {
      const pressure = box.pressure[0] + ((box.pressure[1] - box.pressure[0]) * j) / nP;
      for (const st of states) {
        const inp = { tire, load, pressure, ...st };
        for (const ch of CHANNELS) {
          const f = predict(pack, ch, inp);
          let lo = Infinity;
          let hi = -Infinity;
          for (let k = 0; k < f.length; k++) {
            const v = f[k];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (lo < ext[ch].min) ext[ch].min = lo;
          if (hi > ext[ch].max) {
            ext[ch].max = hi;
            argmax[ch] = `${(load / 1000).toFixed(1)} kN, ${pressure.toFixed(3)} MPa, ${st.condition}/${st.speed} slip ${st.slip.toFixed(2)}`;
          }
        }
        n++;
      }
    }
  }
  report[tire] = { ext, argmax, n };
  console.log(`\n${tire} — ${n} states swept (${n * 3} field reconstructions)`);
  for (const ch of CHANNELS) {
    console.log(
      `  ${ch.padEnd(13)} min ${ext[ch].min.toFixed(4).padStart(9)}   max ${ext[ch].max.toFixed(4).padStart(8)}   peak at ${argmax[ch]}`
    );
  }
}

console.log('\n─── shared across both tires ───');
for (const ch of CHANNELS) {
  const lo = Math.min(report.DTA.ext[ch].min, report.WBT.ext[ch].min);
  const hi = Math.max(report.DTA.ext[ch].max, report.WBT.ext[ch].max);
  const sym = Math.max(Math.abs(lo), Math.abs(hi));
  const wbtShare = (report.WBT.ext[ch].max / hi) * 100;
  console.log(
    `  ${ch.padEnd(13)} [${lo.toFixed(4)}, ${hi.toFixed(4)}]  symmetric ±${sym.toFixed(4)}` +
    `   — WBT reaches ${wbtShare.toFixed(0)}% of the shared top`
  );
}
