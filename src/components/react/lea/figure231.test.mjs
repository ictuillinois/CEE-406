import test from 'node:test';
import assert from 'node:assert/strict';
import { chartById, sampleLattice, sampleCurve, chartValue, clearChartCache } from './charts.ts';
import { peattieFactor, stressFactors } from './threeLayer.ts';

const spec = chartById('fig-2-31');
// Last A station for H = .125, .25, .5, 1, 2, 4, 8, respectively.
// Reference: Handout_ThreeLayerSystem Plots.pdf, pages 1–3, panels (a)–(f).
const panels = [
  [202, [.2, .4, .8, 1.6, 3.2, 3.2, 3.2]],
  [220, [.2, .4, .8, 1.6, 3.2, 3.2, 3.2]],
  [2002, [.4, .8, 1.6, 3.2, 3.2, 3.2, 3.2]],
  [2020, [.4, 1.6, 3.2, 3.2, 3.2, 3.2, 3.2]],
  [20002, [.8, 1.6, 3.2, 3.2, 3.2, 3.2, 3.2]],
  [20020, [1.6, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2]],
];

for (const [panel, ends] of panels) {
  test(`Figure 2.31 ${panel}: printed domain, shared endpoints and subpixel chords`, () => {
    const mesh = sampleLattice(spec, panel);
    assert.equal(mesh.length, 13);
    const family = mesh.filter(c => c.kind === 'family');
    const sweep = mesh.filter(c => c.kind === 'sweep');
    for (const [i, curve] of family.entries()) {
      const end = curve.pts.at(-1);
      assert.ok(Math.abs(end.sweep - ends[i]) < 1e-12);
      const neighbour = sweep.find(c => c.label === ends[i]);
      assert.ok(neighbour.pts.some(p => Math.abs(p.family - curve.label) < 1e-12 &&
        Math.abs(p.value - end.value) < 1e-10));
      const overlay = sampleCurve(spec, curve.label, panel);
      assert.ok(Math.abs(overlay.at(-1).sweep - ends[i]) < 1e-12);
    }
    for (const curve of sweep) {
      const first = ends.findIndex(a => a >= curve.label);
      assert.ok(Math.abs(curve.pts[0].family - spec.family.values[first]) < 1e-12);
    }
    for (const curve of mesh) {
      for (let i = 1; i < curve.pts.length; i++) {
        const p = curve.pts[i - 1], q = curve.pts[i];
        assert.ok(q.x > p.x, 'no duplicate vertices or reversed segments');
        if (!Number.isFinite(p.value) || !Number.isFinite(q.value)) continue;
        assert.ok(p.value > 0 && q.value > 0);
        // Probe quarter points too, independently of the midpoint sampler.
        for (const t of [.25, .5, .75]) {
          const H = p.family ** (1 - t) * q.family ** t;
          const A = p.sweep ** (1 - t) * q.sweep ** t;
          const truth = spec.evaluate(H, A, panel);
          const chord = Math.log10(p.value) * (1 - t) + Math.log10(q.value) * t;
          const pixels = Math.abs(Math.log10(truth) - chord) * 733.5 / 5;
          assert.ok(pixels < .35, `chord error ${pixels}px`);
        }
      }
    }
  });
}

test('single-interface factor agrees with the full solver at all 252 stations', () => {
  for (const [panel] of panels) for (const H of spec.family.values) for (const A of spec.sweep.ticks) {
    const p = { k1: Math.floor(panel / 100), k2: panel % 100, H, A };
    assert.equal(peattieFactor(p), stressFactors(p).peattie);
  }
  for (const v of [0, -1, Infinity, NaN]) {
    assert.ok(Number.isNaN(peattieFactor({ k1: v, k2: 2, H: 1, A: 1 })));
  }
});

test('revisiting a panel and opening its full table require no new evaluations', () => {
  clearChartCache();
  let count = 0;
  const counted = { ...spec, id: 'fig-2-31-cache-test', evaluate: (...args) => {
    count++; return spec.evaluate(...args);
  }};
  const first = sampleLattice(counted, 202);
  const cold = count;
  assert.deepEqual(sampleLattice(counted, 202), first);
  for (const H of spec.family.values) for (const A of spec.sweep.ticks) chartValue(counted, H, A, 202);
  assert.equal(count, cold);
});
