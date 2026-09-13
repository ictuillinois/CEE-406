// Does the island actually render?
//
// A `client:only` island is never rendered at build time, so the first
// person to find a crash in it is whoever opens the page. That is the whole
// reason this file exists, and for LEAPS there is a second reason: the
// workspace markup is a GENERATED string handed to `dangerouslySetInnerHTML`,
// so a transform that emitted a broken template literal, or an icon name the
// set does not carry, is a module-load throw rather than a type error.
// `markup.ts` calls `iconHtml` at import time, so importing it IS that check.
//
// Effects never run under renderToString, so no Plotly, no canvas, no Worker
// and no engine are touched; what is exercised is the synchronous render and
// the module graph behind it, which is where the crash would be.
//
// Run:  node --test src/components/react/leaps/render.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const require = createRequire(import.meta.url);

async function bundle() {
  const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
  const cache = join(ROOT, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  const entry = join(cache, 'leaps-render-entry.tsx');
  const out = join(cache, 'leaps-render.mjs');

  writeFileSync(entry, [
    "export { default as LeapsApp } from '../../src/components/react/leaps/LeapsApp';",
    "export { LEAPS_MARKUP } from '../../src/components/react/leaps/markup.ts';",
    "export { LP_PATHS, iconHtml } from '../../src/components/react/leaps/icons.ts';",
    "export * as app from '../../src/components/react/leaps/leaps.js';",
  ].join('\n'));

  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    jsx: 'automatic',
    loader: { '.css': 'empty' },     // tools.css and leaps.css are side-effect imports
    external: ['react', 'react-dom', 'react-dom/server', 'plotly.js-dist-min'],
    logLevel: 'error',
  });
  return import(pathToFileURL(out).href);
}

const React = require('react');
const { renderToString } = require('react-dom/server');
const mod = await bundle();

test('the island renders', () => {
  const html = renderToString(React.createElement(mod.LeapsApp));
  assert.ok(html.length > 5000, `rendered only ${html.length} characters`);
  assert.ok(html.includes('id="lp-root"'), 'the mount point is missing');
  assert.ok(html.includes('cee-howto'), 'the how-to panel is missing');
});

test('the manual is one click away, and the link leaves this site', () => {
  /* Two links point at the documentation and BOTH have to be absolute here:
   * the button beside the how-to panel, and the app's own line under the
   * Performance cards. Upstream the second one is the relative
   * `documentation.html` next door, which from /tools/leaps/ on this site
   * resolves to a page that does not exist -- so the island injects
   * `docsHref` the same way it injects Plotly and the Worker. A relative
   * href in either place is a 404 nobody sees until a student clicks it. */
  const html = renderToString(React.createElement(mod.LeapsApp));
  const href = /href="(https:\/\/[^"]*documentation\.html)"/.exec(html);
  assert.ok(href, 'the Documentation button is missing or its href is not absolute');
  assert.ok(html.includes('lp-shell-docs'), 'the Documentation button lost its class');
  assert.ok(/target="_blank"/.test(html), 'the manual should open in a new tab');

  const src = readFileSync(join(HERE, 'LeapsApp.tsx'), 'utf8');
  assert.match(src, /docsHref:\s*LEAPS_DOCS_URL/,
    'the app\'s own documentation link must be injected, not left relative');
});

test('every panel of the workspace is in the markup', () => {
  // The five control sections, the four dock tabs and the export block. If a
  // panel is lost in a re-sync it disappears silently — the app finds no
  // element to fill and simply renders one fewer.
  for (const needle of [
    'lp-layers', 'lp-interfaces', 'lp-kind', 'lp-loads', 'lp-points',
    'lp-viewport', 'lp-plan', 'lp-colorbar',
    'data-dpane="points"', 'data-dpane="profiles"', 'data-dpane="layers"', 'data-dpane="performance"',
    'lp-exp-analysis', 'lp-exp-json', 'lp-exp-grid', 'lp-exp-png',
    'lp-unitgate', 'data-units="SI"', 'data-units="US"',
    // the preflight: the badge, the popover it opens and the list inside it.
    // Run refuses to solve when a check fails, so losing the popover would
    // leave a button that declines and never says why.
    'lp-checks-btn', 'lp-checks-pop', 'lp-checks-list',
    'lp-kind-note',
  ]) {
    assert.ok(mod.LEAPS_MARKUP.includes(needle), `the workspace markup lost ${needle}`);
  }
});

test('the markup carries drawn glyphs, not font classes', () => {
  assert.ok(!mod.LEAPS_MARKUP.includes('class="fas'), 'Font Awesome markup survived the port');
  const svgs = mod.LEAPS_MARKUP.split('<svg class="lp-i').length - 1;
  assert.ok(svgs >= 40, `only ${svgs} glyphs were drawn into the markup`);
});

test('an unknown glyph name is a throw, not an empty square', () => {
  // The icon set is keyed by the UPSTREAM class name so the transform never
  // has to translate one. That only helps if a name the set does not carry
  // is loud: a blank 1em box in a toolbar is exactly the kind of thing that
  // ships.
  assert.throws(() => mod.iconHtml('fa-not-a-real-glyph'), /no glyph/);
  assert.ok(mod.iconHtml('fa-plus').startsWith('<svg'));
  assert.ok(mod.iconHtml('fa-plus', 'Add a layer').includes('<title>Add a layer</title>'));
});

test('the app module exposes what the shell and the tests need', () => {
  assert.equal(typeof mod.app.initLeaps, 'function');
  assert.ok(mod.app.LOAD_KINDS.length === 3, 'three load idealizations');
  assert.deepEqual(mod.app.LOAD_KINDS.map(k => k.id), ['circle', 'point', 'line']);
  assert.ok(mod.app.UNITS.SI && mod.app.UNITS.US, 'both unit systems');

  // The results table is WinJULEA's row order, and that order is the whole
  // point of the table — a reader puts the two programs side by side.
  assert.deepEqual(mod.app.RESULT_ROWS.map(r => r.key), [
    'x', 'y', 'z',
    'sxx', 'syy', 'szz', 'sxz', 'syz', 'sxy',
    'exx', 'eyy', 'ezz', 'gxz', 'gyz', 'gxy',
    'ux', 'uy', 'uz',
    's1', 's2', 's3',
    'e1', 'e2', 'e3',
  ]);
  // every row belongs to a group that exists, and every group is used
  const groups = new Set(mod.app.RESULT_GROUPS.map(g => g.id));
  for (const r of mod.app.RESULT_ROWS) assert.ok(groups.has(r.g), `row ${r.key} has no group`);
  for (const g of groups) {
    assert.ok(mod.app.RESULT_ROWS.some(r => r.g === g), `group ${g} has no rows`);
  }
});

test('SI is millimeters, newtons and megapascals', () => {
  // The course works in mm/N/MPa and the engine IS mm/N/MPa, so every SI
  // conversion factor is exactly one. A factor that drifts here is a silent
  // order-of-magnitude error in every number on screen.
  const si = mod.app.UNITS.SI;
  for (const q of ['len', 'stress', 'modulus', 'force', 'defl', 'kitf', 'perlen']) {
    assert.equal(si[q].k, 1, `SI ${q} should pass through unchanged`);
  }
  assert.equal(si.len.u, 'mm');
  assert.equal(si.force.u, 'N');
  assert.equal(si.stress.u, 'MPa');
  assert.equal(si.modulus.u, 'MPa');
  assert.equal(si.strain.k, 1e6);

  // English is WinJULEA's own column set: inches, pounds, psi — a modulus in
  // psi rather than ksi, and a displacement in inches rather than mils.
  const us = mod.app.UNITS.US;
  assert.equal(us.len.u, 'in');
  assert.equal(us.force.u, 'lb');
  assert.equal(us.stress.u, 'psi');
  assert.equal(us.modulus.u, 'psi');
  assert.equal(us.defl.u, 'in');
  assert.ok(Math.abs(us.len.k - 1 / 25.4) < 1e-15);
  assert.ok(Math.abs(us.stress.k - 145.0377377) < 1e-6);
  assert.ok(Math.abs(us.force.k - 0.2248089431) < 1e-9);
  // the derived pair has to be the product of the two it is derived from
  assert.ok(Math.abs(us.kitf.k - us.stress.k / us.len.k) < 1e-6, 'psi/in is psi per inch');
  assert.ok(Math.abs(us.perlen.k - us.force.k / us.len.k) < 1e-9, 'lb/in is pounds per inch');
});

test('every template builds a section the solver can take', () => {
  for (const t of mod.app.TEMPLATES) {
    assert.ok(t.layers.length >= 1, `${t.id} has no layers`);
    assert.ok(t.params.F > 0 && t.params.p > 0, `${t.id} has no load`);
    if (t.slips) {
      assert.equal(t.slips.length, t.layers.length - 1, `${t.id}: one slip per interface`);
      for (const s of t.slips) assert.ok(s >= 0 && s <= 1, `${t.id}: slip out of range`);
    }
    for (const L of t.layers) {
      assert.ok(mod.app.MATERIALS.some(m => m.id === L.mat), `${t.id}: unknown material ${L.mat}`);
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
 * The 3-D view's projection
 *
 * The scene is drawn on a 2-D canvas by hand, so the projection is the one
 * piece of it that can be checked without pixels, and two of its properties
 * are load-bearing rather than incidental.
 * ═══════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════
 * 6. The 3-D view's projection
 *
 * The scene is drawn on a 2-D canvas by hand, so the projection is the one
 * piece of it that can be checked without pixels, and two of its properties
 * are load-bearing rather than incidental.
 * ═══════════════════════════════════════════════════════════════════════ */

test('the z axis projects straight down the page, at every camera angle', () => {
    /* This is what keeps DEPTH reading as depth: a drop line from an
     * evaluation point to the surface is plumb, a layer is a band rather
     * than a wedge, and the contour poured onto the cut plane is not
     * sheared out of square with the layers it sits in. Yaw the camera and
     * it must still hold; there is no angle at which a pavement layer may
     * lean. */
    for (const az of [0, 12, 34, 45, 78, 90, 137, 215, 359]) {
        for (const el of [6, 12, 26, 45, 72]) {
            const B = mod.app.axonometric(az, el, 1);
            assert.equal(B.ez[0], 0, `z leans at az=${az}, el=${el}`);
            assert.ok(B.ez[1] > 0, `z must point DOWN the page at az=${az}, el=${el}`);
        }
    }
});

test('the projection is affine and orthographic', () => {
    /* Affine is what lets the contour image be poured onto the cut face
     * with one ctx.transform rather than resampled point by point, so it is
     * a performance contract as much as a geometric one. Orthographic is
     * what lets the figure be measured: the same length must project to the
     * same number of pixels wherever in the box it sits, which a
     * perspective camera would not do. */
    const B = mod.app.axonometric(34, 26, 1);
    const P = (x, y, z) => [
        x * B.ex[0] + y * B.ey[0] + z * B.ez[0],
        x * B.ex[1] + y * B.ey[1] + z * B.ez[1]
    ];
    const a = P(-300, 120, 50), b = P(700, -40, 900);
    const mid = P((-300 + 700) / 2, (120 - 40) / 2, (50 + 900) / 2);
    assert.ok(Math.abs(mid[0] - (a[0] + b[0]) / 2) < 1e-9, 'midpoints must map to midpoints');
    assert.ok(Math.abs(mid[1] - (a[1] + b[1]) / 2) < 1e-9, 'midpoints must map to midpoints');

    // the same vector, twice, in two places: the same screen displacement
    const d1 = P(150, 0, 0), d0 = P(0, 0, 0);
    const e1 = P(150 + 900, 400, 600), e0 = P(900, 400, 600);
    assert.ok(Math.abs((d1[0] - d0[0]) - (e1[0] - e0[0])) < 1e-9, 'a length must not depend on where it is');
    assert.ok(Math.abs((d1[1] - d0[1]) - (e1[1] - e0[1])) < 1e-9, 'a length must not depend on where it is');
});

test('scale is a multiplier on the whole basis', () => {
    const a = mod.app.axonometric(40, 30, 1), b = mod.app.axonometric(40, 30, 7);
    ['ex', 'ey', 'ez'].forEach(k => {
        assert.ok(Math.abs(b[k][0] - 7 * a[k][0]) < 1e-12, `${k} x is not linear in scale`);
        assert.ok(Math.abs(b[k][1] - 7 * a[k][1]) < 1e-12, `${k} y is not linear in scale`);
    });
});

/* ═══════════════════════════════════════════════════════════════════════
 * The distress transfer functions
 *
 * They were written inline in the panel that printed them until the design
 * study needed the same numbers, and a calibration constant that exists in
 * two places is one that will eventually differ in two places. Pinned here
 * against the Asphalt Institute forms and against a case the tool itself
 * prints, so the two panels can never drift apart silently.
 * ═══════════════════════════════════════════════════════════════════════ */

test('the Asphalt Institute fatigue equation, as printed', () => {
  // Nf = 0.0796 (eps_t)^-3.291 (E)^-0.854, strain dimensionless, E in psi.
  // The tool's own AASHTO template: eps_t = 237.7 ue at E1 = 3000 MPa, which
  // the Performance card prints as 1.03e6 repetitions.
  const Nf = mod.app.fatigueLife(237.7e-6, 3000);
  assert.ok(Math.abs(Nf / 1.03e6 - 1) < 0.01, `fatigue life came out ${Nf.toExponential(3)}`);

  // The conversion to psi happens inside, so a caller cannot forget it:
  // passing psi where MPa belongs must NOT quietly agree.
  const wrong = mod.app.fatigueLife(237.7e-6, 3000 * 145.0377377);
  assert.ok(wrong < Nf / 3, 'the modulus argument is megapascals, and the units must matter');

  // the exponent is what it is: halving the strain must multiply the life
  // by 2^3.291
  const half = mod.app.fatigueLife(118.85e-6, 3000);
  assert.ok(Math.abs(half / Nf - Math.pow(2, 3.291)) / Math.pow(2, 3.291) < 1e-9);
});

test('the subgrade rutting equation, as printed', () => {
  // Nr = 1.365e-9 (eps_v)^-4.477. The same template: 344.2 ue at the top of
  // the subgrade, which the Performance card prints as 4.36e6 repetitions.
  const Nr = mod.app.ruttingLife(344.2e-6);
  assert.ok(Math.abs(Nr / 4.36e6 - 1) < 0.01, `rutting life came out ${Nr.toExponential(3)}`);
  const half = mod.app.ruttingLife(172.1e-6);
  assert.ok(Math.abs(half / Nr - Math.pow(2, 4.477)) / Math.pow(2, 4.477) < 1e-9);
});

test('a pavement fails by whichever mechanism gets there first', () => {
  const g1 = mod.app.governingLife(1e5, 4e6);
  assert.equal(g1.N, 1e5);
  assert.equal(g1.by, 'Fatigue cracking');
  const g2 = mod.app.governingLife(4e6, 1e5);
  assert.equal(g2.N, 1e5);
  assert.equal(g2.by, 'Subgrade rutting');
  // an unbound surface has no fatigue life, and that is not a reason to
  // report no life at all
  assert.equal(mod.app.governingLife(null, 7e5).N, 7e5);
  assert.equal(mod.app.governingLife(null, null), null);

  // the shipped AASHTO template, end to end: 237.7 ue at the base of the
  // asphalt and 344.2 ue on the subgrade, which the tool prints as a
  // 1.03e6-repetition pavement governed by fatigue
  const g = mod.app.governingLife(
    mod.app.fatigueLife(237.7e-6, 3000),
    mod.app.ruttingLife(344.2e-6));
  assert.equal(g.by, 'Fatigue cracking');
  assert.ok(Math.abs(g.N / 1.03e6 - 1) < 0.01, `governing life came out ${g.N.toExponential(3)}`);
});

test('a life is null rather than infinite where there is no strain', () => {
  // A zero or negative strain is not a pavement that lasts forever, it is a
  // response that was not found; the panels print a blank for it.
  assert.equal(mod.app.fatigueLife(0, 3000), null);
  assert.equal(mod.app.fatigueLife(-1e-4, 3000), null);
  assert.equal(mod.app.fatigueLife(2e-4, 0), null);
  assert.equal(mod.app.ruttingLife(0), null);
});

test('the design study is in the markup, and can be reached', () => {
  /* One canvas, five panes, and the study is the only one that solves
   * sections other than the one on screen -- so if its controls are lost in
   * a re-sync the tab is there and does nothing. */
  for (const needle of [
    'data-dtab="study"', 'data-dpane="study"',
    'lp-study-var', 'lp-study-from', 'lp-study-to', 'lp-study-steps',
    'lp-study-run', 'lp-study-resp', 'lp-study-target', 'lp-chart-study', 'lp-study-note',
  ]) {
    assert.ok(mod.LEAPS_MARKUP.includes(needle), `the study lost ${needle}`);
  }
});

test('the grid mirror applies the reflection the engine would', () => {
  /* `mirrorXPoint` is what makes half a contour grid enough. The physics
   * half of this is in engine.test.mjs, which checks that the ENGINE gives
   * a mirror-symmetric field under a mirror-symmetric gear; this is the
   * other half: that the app's reflection does what a reflection does. */
  const p = {
    x: 420, y: 90, z: 100, li: 0,
    sig: { xx: 1, yy: 2, zz: 3, xy: 4, xz: 5, yz: 6 },
    eps: { xx: 7, yy: 8, zz: 9, xy: 10, xz: 11, yz: 12 },
    disp: { ux: 13, uy: 14, uz: 15 },
    principal: { s1: 3, s2: 2, s3: 1 }, epsPrincipal: { e1: 9, e2: 8, e3: 7 },
    vm: 16, tauMax: 17, tauOct: 18, meanStress: 19, bulkStress: 20,
    converged: true, singular: false,
  };
  const m = mod.app.mirrorXPoint(p);
  assert.equal(m.x, -420, 'the point moves to the other side');
  assert.equal(m.y, 90);
  assert.equal(m.z, 100);
  assert.equal(m.li, 0, 'the layer it sits in does not change');

  // one x index flips, two or none does not
  assert.deepEqual(m.sig, { xx: 1, yy: 2, zz: 3, xy: -4, xz: -5, yz: 6 });
  assert.deepEqual(m.eps, { xx: 7, yy: 8, zz: 9, xy: -10, xz: -11, yz: 12 });
  assert.deepEqual(m.disp, { ux: -13, uy: 14, uz: 15 });

  // an orthogonal map leaves every invariant alone
  assert.deepEqual(m.principal, p.principal);
  assert.deepEqual(m.epsPrincipal, p.epsPrincipal);
  assert.equal(m.vm, 16);
  assert.equal(m.tauMax, 17);
  assert.equal(m.meanStress, 19);

  // and it is a copy: the half that was solved must not be rewritten
  assert.equal(p.sig.xz, 5, 'the source point was mutated');
  assert.equal(p.disp.ux, 13, 'the source point was mutated');
});

test('the view direction is the one the projection actually has', () => {
  /* Back-face culling asks "is this face turned away", and it asks it with
   * `viewDir3` while the picture is drawn with `axonometric`. If the two
   * ever disagree, faces of the box vanish or the inside of a tire is drawn
   * over its outside, at some camera angles and not others - which is the
   * worst kind of bug to find by looking.
   *
   * They agree if and only if moving a point ALONG the view direction does
   * not move it on screen, which is the definition of the direction an
   * orthographic camera looks in. */
  for (const az of [12, 30, 45, 60, 78]) {
    for (const el of [12, 26, 35.264, 50, 72]) {
      const B = mod.app.axonometric(az, el, 1);
      const w = mod.app.viewDir3(az, el);
      const P = (x, y, z) => [
        x * B.ex[0] + y * B.ey[0] + z * B.ez[0],
        x * B.ex[1] + y * B.ey[1] + z * B.ez[1],
      ];
      const p0 = P(120, -300, 40);
      for (const t of [-900, -1, 1, 500]) {
        const p1 = P(120 + t * w[0], -300 + t * w[1], 40 + t * w[2]);
        assert.ok(Math.abs(p1[0] - p0[0]) < 1e-9,
          `moving along the view direction moved x on screen at az=${az} el=${el}`);
        assert.ok(Math.abs(p1[1] - p0[1]) < 1e-9,
          `moving along the view direction moved y on screen at az=${az} el=${el}`);
      }
      // and it points INTO the scene: a camera above the pavement looks down
      assert.ok(w[2] > 0, `the camera must look downward at el=${el}`);
      // the top face, whose outward normal is -z, must therefore be visible
      assert.ok(-w[2] < 0, 'the top of the box must never be culled');
    }
  }
});

test('every face the reader can see is lit', () => {
  /* The light follows the camera on purpose: a fixed world light puts a
   * face of the box into the dark the moment the camera swings past it, and
   * a drawing whose material nobody can read is worse than one that is not
   * physically shaded. The ambient floor is what guarantees it. */
  for (const az of [12, 30, 45, 60, 78]) {
    for (const el of [12, 26, 35.264, 50, 72]) {
      const w = mod.app.viewDir3(az, el);
      const faces = [[0, 0, -1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0]];
      for (const n of faces) {
        if (n[0] * w[0] + n[1] * w[1] + n[2] * w[2] >= 0) continue;   // turned away
        const k = mod.app.lambert3(n, mod.app.axonometric ? lightOf(az, el) : null);
        assert.ok(k >= 0.55 && k <= 1.06,
          `a visible face came out at ${k} at az=${az} el=${el}`);
      }
    }
  }
  function lightOf(az, el) {
    const aL = (az - 25) * Math.PI / 180;
    const eL = Math.min(Math.max(el + 35, 30), 80) * Math.PI / 180;
    const ce = Math.cos(eL);
    return [-Math.sin(aL) * ce, -Math.cos(aL) * ce, -Math.sin(eL)];
  }
});
