import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_DATA } from './data.ts';
import { shiftData, fitSigmoid, fitSpectrum } from './equations.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const entry = join(cache, 'tts-render-entry.tsx'), output = join(cache, 'tts-render.mjs');
writeFileSync(entry, "export { default, FinalResults } from '../../src/components/react/tts/TtsApp';");
await build({ entryPoints: [entry], outfile: output, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
  loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'plotly.js-dist-min'], logLevel: 'error' });
const components = await import(pathToFileURL(output).href);
const React = require('react'), { renderToString } = require('react-dom/server');
globalThis.document = { documentElement: { getAttribute: () => null } };
globalThis.window = { matchMedia: () => ({ matches: false }) };

test('manual workspace starts unshifted, reference fixed, final results unavailable', () => {
  const html = renderToString(React.createElement(components.default)).replaceAll('<!-- -->', '');
  assert.match(html, /shifts start at zero/);
  assert.match(html, /Shift factors must be unique/);
  assert.match(html, /0\.5855/);
  assert.match(html, /disabled=""[^>]*>3\. Final fit/);
  assert.match(html, /disabled=""[^>]*aria-label="Log shift at 21 °C"/);
  assert.equal([...html.matchAll(/type="range"/g)].length, 5);
});

const shifts = { '-10': 4.25, 4: 2.25, 21: 0, 37: -1.8, 54: -3.25 };
function renderFinal(data) {
  const points = shiftData(data, shifts);
  return renderToString(React.createElement(components.FinalResults, {
    snapshot: { points, shifts, reference: 21, fit: fitSigmoid(points), spectrum: fitSpectrum(points), equilibrium: 1 },
    legend: [], groupTraces: () => [], domain: () => [0.001, 1, 1000], color: '#0F1A2E',
  }));
}
test('final fit renders all requested responses with separate relaxation and creep units', () => {
  const html = renderFinal(DEFAULT_DATA);
  for (const title of ['Storage modulus', 'Loss modulus', 'Phase angle', 'Shift factors', 'Dynamic modulus · reduced frequency', 'Relaxation modulus E(t)', 'Creep compliance J(t)'])
    assert.ok(html.includes(title), title);
  assert.match(html, /J\(t\) is not 1\/E\(t\)/);
  assert.match(html, /Download fit \+ shifts/);
  assert.match(html, /0\.02047/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
test('modulus-only data never fabricate a phase or time-domain model', () => {
  const html = renderFinal(DEFAULT_DATA.map(p => ({ ...p, phase: null })));
  assert.match(html, /Response curves are unavailable/);
  assert.match(html, /Time-domain responses need phase data/);
  assert.doesNotMatch(html, /title="Creep compliance J\(t\)"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
