// Does the UI actually render?
//
// Everything else in this folder tests physics, and physics is the part that
// is easy to test. The part that actually breaks is the render path: a chart
// spec with a panel the reader dereferences unconditionally, a table built
// from ticks that a particular figure does not have, a null root list mapped
// over. TypeScript catches some of that and the build catches none of it,
// because a `client:only` island is never rendered at build time — the first
// person to find out is whoever opens the page.
//
// So this renders every module and every one of the twelve chart
// configurations to a string and fails if any of them throws. Effects do not
// run under renderToString, so Plotly is never loaded and no canvas is needed;
// what is exercised is exactly the synchronous render, which is where the
// crash would be.
//
// Run:  node --test src/components/react/lea/render.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const require = createRequire(import.meta.url);

/* The components are TSX and Node cannot load them, so they are bundled once
   with esbuild — already present as vite's own dependency. React and
   react-dom stay external and are resolved from the repo, so the bundle lands
   inside node_modules/.cache where their bare specifiers still work. */
async function bundle() {
  const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
  const cache = join(ROOT, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  const entry = join(cache, 'lea-render-entry.tsx');
  const out = join(cache, 'lea-render.mjs');

  writeFileSync(entry, [
    "export { default as LeaApp } from '../../src/components/react/lea/LeaApp';",
    "export { default as OneLayerModule } from '../../src/components/react/lea/modules/OneLayerModule';",
    "export { default as TwoLayerModule } from '../../src/components/react/lea/modules/TwoLayerModule';",
    "export { default as ThreeLayerModule } from '../../src/components/react/lea/modules/ThreeLayerModule';",
    "export { default as MultiLayerModule } from '../../src/components/react/lea/modules/MultiLayerModule';",
    "export { default as ChartsModule } from '../../src/components/react/lea/modules/ChartsModule';",
    "export { default as ChartReader } from '../../src/components/react/lea/modules/ChartReader';",
    "export { CHARTS } from '../../src/components/react/lea/charts.ts';",
    "export { moduleLock } from '../../src/data/release.ts';",
  ].join('\n'));

  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    jsx: 'automatic',
    loader: { '.css': 'empty' },     // tools.css is a side-effect import
    external: ['react', 'react-dom', 'react-dom/server', 'plotly.js-dist-min'],
    logLevel: 'error',
  });
  return import(pathToFileURL(out).href);
}

/* The only browser API touched during render is the one useTheme reads in its
   lazy initializer. Everything else lives in an effect. */
globalThis.document ??= { documentElement: { getAttribute: () => null } };
globalThis.window ??= { matchMedia: () => ({ matches: false }) };

const React = require('react');
const { renderToString } = require('react-dom/server');
const mod = await bundle();

test('every module renders', () => {
  for (const name of [
    'LeaApp', 'OneLayerModule', 'TwoLayerModule',
    'ThreeLayerModule', 'MultiLayerModule', 'ChartsModule',
  ]) {
    const html = renderToString(React.createElement(mod[name]));
    assert.ok(html.length > 500, `${name} rendered only ${html.length} characters`);
  }
});

test('every chart in the catalog renders in the reader', () => {
  // Twelve figures with three different axis shapes, two nomographs, panelled
  // and un-panelled, with and without anchors, one of them heavy. They differ
  // enough from each other that any of them can break alone.
  for (const spec of mod.CHARTS) {
    const html = renderToString(React.createElement(mod.ChartReader, { spec }));
    assert.ok(html.length > 500, `${spec.id} rendered only ${html.length} characters`);
    assert.ok(html.includes(spec.figure), `${spec.id} does not name its figure`);
  }
});

/* ── The module gate ─────────────────────────────────────────────────────
 * Which modules of a tab-shell tool are open is `release.ts`'s decision, and
 * on a client island it is enforced nowhere else — there is no route to
 * remove and no file to rename, so if the shell stops honouring the gate a
 * locked module is simply live again and nothing else notices. The failure
 * mode that actually costs something is subtler than that, though: the tool
 * opening on a tab that is locked, which leaves a student on a dimmed,
 * unreachable panel with no way to see what they came for.
 */
test('lea opens on a released module and renders only that one', () => {
    const html = renderToString(React.createElement(mod.LeaApp));

    // The charts module's own control, so this is the panel that rendered.
    assert.ok(html.includes('chart-pick'),
        'lea did not open on "Solutions by chart"');

    // And no locked module's panel came with it.
    for (const [id, marker] of [
        ['one', 'ol-q'], ['two', 'tl-e1'], ['three', 'tr-h1'], ['multi', 'ml-q'],
    ]) {
        if (mod.moduleLock('lea', id).released) continue;
        assert.ok(!html.includes(`id="${marker}"`),
            `the ${id} module is locked but its panel rendered`);
    }
});

test('every module keeps a tab, and a locked one is inert', () => {
    const html = renderToString(React.createElement(mod.LeaApp));

    // The ladder is the teaching content: the tabs stay in the strip whether
    // or not the course has reached them.
    for (const label of [
        'Solutions by chart', 'One layer', 'Two layers', 'Three layers', 'N layers',
    ]) {
        assert.ok(html.includes(label), `the ${label} tab is missing from the strip`);
    }

    const locked = ['one', 'two', 'three', 'multi'].filter(
        id => !mod.moduleLock('lea', id).released);
    assert.ok(locked.length > 0, 'expected the solver modules to be locked for now');

    for (const id of locked) {
        const tab = new RegExp(`<button[^>]*id="lea-tab-${id}"[^>]*>`).exec(html);
        assert.ok(tab, `no tab rendered for the locked ${id} module`);
        assert.match(tab[0], /aria-disabled="true"/,
            `the ${id} tab is locked but not marked aria-disabled`);
        assert.match(tab[0], /is-locked/, `the ${id} tab carries no locked styling`);
        assert.doesNotMatch(tab[0], /aria-selected="true"/,
            `the ${id} tab is locked but selected`);
    }

    // The open one is the selected one.
    const open = new RegExp('<button[^>]*id="lea-tab-charts"[^>]*>').exec(html);
    assert.ok(open && /aria-selected="true"/.test(open[0]),
        'the charts tab should be the selected one');
    assert.doesNotMatch(open[0], /aria-disabled/, 'the open tab must not be disabled');
});

test('a chart with no anchors still renders its reader', () => {
  // Figure 2.5 has no worked example in the book, so its checkpoints card is
  // absent — the branch that is skipped for every other chart.
  const bare = mod.CHARTS.find(c => !c.anchors?.length);
  assert.ok(bare, 'expected at least one chart without anchors');
  const html = renderToString(React.createElement(mod.ChartReader, { spec: bare }));
  assert.ok(!html.includes('Checkpoints from the book'),
    `${bare.id} has no anchors but rendered the checkpoints card`);
});

test('the reader survives a spec whose family is empty', () => {
  // Not a spec the catalog ships, but the render path should degrade rather
  // than throw if one is ever added mid-edit.
  const spec = { ...mod.CHARTS[0], id: 'empty', family: { ...mod.CHARTS[0].family, values: [] } };
  assert.doesNotThrow(() => renderToString(React.createElement(mod.ChartReader, { spec })));
});
