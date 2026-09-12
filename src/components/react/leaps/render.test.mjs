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
